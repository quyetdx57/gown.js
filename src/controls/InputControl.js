var Skinable = require('../core/Skinable'),
    KeyboardManager = require('../interaction/KeyboardManager'),
    InputWrapper = require('../utils/InputWrapper');

/**
 * InputControl used for TextInput, TextArea and everything else that
 * is capable of entering text
 *
 * InputControl is the visual represenation of the text input, take a look
 * at the KeyboardWrapper/DOMInputWrapper for the handling of the selection and
 * the text changes
 *
 * roughly based on PIXI.Input InputObject by Sebastian Nette,
 * see https://github.com/SebastianNette/PIXI.Input
 *
 * @class InputControl
 * @extends GOWN.Skinable
 * @memberof GOWN
 * @constructor
 */
function InputControl(theme, type) {
    Skinable.call(this, theme);

    this.receiveKeys = true;

    // prevent other interaction (touch/move) on this component
    // (to allow text selection, set to true if you like to have the
    //  InputControl as child of some element that can be moved)
    // thid does NOT effect text input
    this.autoPreventInteraction = false;

    this._inputType = 'text';

    // offset from the top-left corner in pixel to the skin
    // TODO: put in theme!
    this.textOffset = new PIXI.Point(5, 4);

    this.text = this.text || '';

    this.hasFocus = false;

    /**
     * indicates if the mouse button has been pressed
     * @property _mouseDown
     * @type {boolean}
     * @private
     */
    this._mouseDown = false;

    this.currentState = InputControl.UP;

    /**
     * timer used to indicate if the cursor is shown
     *
     * @property _cursorTimer
     * @type {Number}
     * @private
     */
    this._cursorTimer = 0;

    /**
     * indicates if the cursor position has changed
     *
     * @property _cursorNeedsUpdate
     * @type {Boolean}
     * @private
     */

    this._cursorNeedsUpdate = true;

    /**
     * interval for the cursor (in milliseconds)
     *
     * @property blinkInterval
     * @type {number}
     */
    this.blinkInterval = 500;

    this._restrict = '';

    // create dom element for DOMInputWrapper
    // (not needed if we run inside cordova/cocoon)
    if (KeyboardManager.wrapper.createInput) {
        KeyboardManager.wrapper.createInput(type);
        this.wrapperType = type;
    }

    // add events to listen to react to the Keyboard- and InteractionManager
    this.addEvents();

    //SD: set style for text input
    this.cursorStyle = this.cursorStyle || new ThemeFont();

    // cursor is the caret/selection sprite
    this.cursorView = new PIXI.Text('|', this.cursorStyle);
    if (this.pixiText) {
        this.cursorView.y = this.pixiText.y;
    }
    this.addChild(this.cursorView);

    // selection background
    this.selectionBg = new PIXI.Graphics();
    this.addChildAt(this.selectionBg, 0);

    // TODO: remove events on destroy
    // setup events
    this.on('touchstart', this.onDown, this);
    this.on('mousedown', this.onDown, this);
}

InputControl.prototype = Object.create( Skinable.prototype );
InputControl.prototype.constructor = InputControl;
module.exports = InputControl;

/**
 * Up state: mouse button is released or finger is removed from the screen
 *
 * @property UP
 * @static
 * @final
 * @type String
 */
InputControl.UP = 'up';

/**
 * Down state: mouse button is pressed or finger touches the screen
 *
 * @property DOWN
 * @static
 * @final
 * @type String
 */
InputControl.DOWN = 'down';

/**
 * Hover state: mouse pointer hovers over the button
 * (ignored on mobile)
 *
 * @property HOVER
 * @static
 * @final
 * @type String
 */
InputControl.HOVER = 'hover';

/**
 * Hover state: mouse pointer hovers over the button
 * (ignored on mobile)
 *
 * @property HOVER
 * @static
 * @final
 * @type String
 */
InputControl.OUT = 'out';


/**
 * names of possible states for a button
 *
 * @property stateNames
 * @static
 * @final
 * @type String
 */
InputControl.stateNames = [
    InputControl.UP, InputControl.DOWN, InputControl.HOVER
];

/**
 * currently selected input control
 * (used for tab index)
 *
 * @property currentInput
 * @type GOWN.InputControl
 * @static
 */
InputControl.currentInput = null;

InputControl.prototype.onKeyUp = function () {
};

InputControl.prototype.onKeyDown = function () {

};

InputControl.prototype.addEvents = function() {
    this.on('keyup', this.onInputChanged.bind(this));
};

InputControl.prototype.onInputChanged = function () {
    if (!this.hasFocus) {
        return;
    }

    var text = KeyboardManager.wrapper.text;

    //overrides the current text with the user input from the InputWrapper
    if(text !== this.text) {
        this.text = text;
    }

    console.log("onInputChanged" + text);
    KeyboardManager.wrapper.cursorPos = KeyboardManager.wrapper.selection[0];
    this.setCursorPos();
};

/**
 * position cursor on the text
 */
InputControl.prototype.setCursorPos = function () {
    this.textToPixelPos(KeyboardManager.wrapper.cursorPos, this.cursorView.position);
    this.cursorView.position.x += this.pixiText.x;
    this.cursorView.position.y += this.pixiText.y;
};

InputControl.prototype.skinableSetTheme = Skinable.prototype.setTheme;
/**
 * change the theme
 *
 * @method setTheme
 * @param theme the new theme {Theme}
 */
InputControl.prototype.setTheme = function(theme) {
    if (theme === this.theme || !theme) {
        return;
    }
    this.skinableSetTheme(theme);
    // copy text so we can force wordwrap
    this.style = theme.textStyle;
};

InputControl.prototype.setPixiText = function(text) {
    this._displayText = text || '';
    if (!this.pixiText) {
        this.pixiText = new PIXI.Text(text, this.textStyle);
        this.pixiText.position = this.textOffset;
        this.addChild(this.pixiText);
    } else {
        this.pixiText.text = text;
    }
};

Object.defineProperty(InputControl.prototype, 'wrapper', {
    get: function () {
        return KeyboardManager.wrapper;
    }
});
/**
 * set the text that is shown inside the input field.
 * calls onTextChange callback if text changes
 *
 * @property text
 * @type String
 */
Object.defineProperty(InputControl.prototype, 'text', {
    get: function () {
        if (this.pixiText) {
            return this.pixiText.text;
        }
        return this._origText;
    },
    set: function (text) {
        text += ''; // add '' to assure text is parsed as string

        if (this.maxChars > 0 && text.length > this.maxChars) {
            return;
        }

        if (this._origText === text) {
            // return if text has not changed
            return;
        }
        this._origText = text;
        this.setPixiText(text);

        // reposition cursor
        this._cursorNeedsUpdate = true;
    }
});

/**
 * The maximum number of characters that may be entered. If 0,
 * any number of characters may be entered.
 * (same as maxLength for DOM inputs)
 *
 * @default 0
 * @property maxChars
 * @type String
 */
Object.defineProperty(InputControl.prototype, 'maxChars', {
    get: function () {
        return this._maxChars;
    },
    set: function (value) {
        if (this._maxChars === value) {
            return;
        }
        if (this.pixiText.text > value) {
            this.pixiText.text = this.pixiText.text.substring(0, value);
            KeyboardManager.wrapper.maxChars = value;
            if (KeyboardManager.wrapper.cursorPos > value) {
                KeyboardManager.wrapper.cursorPos = value;
                this._cursorNeedsUpdate = true;
            }
        }
        this._maxChars = value;
    }
});

Object.defineProperty(InputControl.prototype, 'value', {
    get: function() {
        return this._origText;
    }
});

/**
 * get text width
 *
 * @method textWidth
 * @param text
 * @returns {*}
 */
InputControl.prototype.textWidth = function(text) {
    // TODO: support BitmapText for PIXI v3+
    if (!this.text._isBitmapFont) {
        var ctx = this.pixiText.context;
        return ctx.measureText(text || '').width;
    }
    else {
        var prevCharCode = null;
        var width = 0;
        var data = this.pixiText._data;
        for (var i = 0; i < text.length; i++) {
            var charCode = text.charCodeAt(i);
            var charData = data.chars[charCode];
            if (!charData) {
                continue;
            }
            if (prevCharCode && charData.kerning[prevCharCode]) {
                width += charData.kerning[prevCharCode];
            }
            width += charData.xAdvance;
            prevCharCode = charCode;
        }
        return width * this.pixiText._scale;
    }
};

/**
 * focus on this input and set it as current
 *
 * @method focus
 */
InputControl.prototype.focus = function () {
    // is already current input
    if (InputControl.currentInput === this) {
        return;
    }

    // drop focus
    if (InputControl.currentInput) {
        InputControl.currentInput.blur();
    }

    // set focus
    InputControl.currentInput = this;
    this.hasFocus = true;

    this.emit('focusIn', this);

    KeyboardManager.wrapper.focus(this.wrapperType);
};

InputControl.prototype.onMouseUpOutside = function() {
    if(this.hasFocus && !this._mouseDown) {
        this.blur();
    }
    this._mouseDown = false;
};

/**
 * blur the text input (remove focus)
 *
 * @method blur
 */
InputControl.prototype.blur = function() {
    if (InputControl.currentInput === this) {
        InputControl.currentInput = null;
        this.hasFocus = false;

        // blur hidden input (if DOMInputWrapper is used)
        KeyboardManager.wrapper.blur();
        this.onblur();
    }
};

/**
 * height of the line in pixel
 * (assume that every character of pixi text has the same line height)
 */
InputControl.prototype.lineHeight = function() {
    var style = this.pixiText._style;
    var lineHeight = style.lineHeight || style.fontSize + style.strokeThickness;
    return lineHeight;
};

/**
 * draw the cursor
 *
 * @method drawCursor
 */
InputControl.prototype.drawCursor = function () {
    // TODO: use Tween instead!
    if (this.hasFocus || this._mouseDown) {
        var time = Date.now();

        // blink interval for cursor
        if ((time - this._cursorTimer) >= this.blinkInterval) {
            this._cursorTimer = time;
            this.cursorView.visible = !this.cursorView.visible;
        }

        // update cursor position
        if (this.cursorView.visible && this._cursorNeedsUpdate) {
            this.setCursorPos();
            this._cursorNeedsUpdate = false;
        }
    } else {
        this.cursorView.visible = false;
    }
};

InputControl.prototype.onMove = function (e) {
    if (this.autoPreventInteraction) {
        e.stopPropagation();
    }

    var mouse = e.data.getLocalPosition(this.pixiText);
    if (!this.hasFocus || !this._mouseDown) { // || !this.containsPoint(mouse)) {
        return false;
    }

    var curPos = this.pixelToTextPos(mouse),
        start = KeyboardManager.wrapper.selectionStart,
        end = curPos;

    if (KeyboardManager.wrapper.updateSelection(start, end)) {
        this._cursorNeedsUpdate = true;
        this._selectionNeedsUpdate = true;
        KeyboardManager.wrapper.cursorPos = curPos;
        this.setCursorPos();
    }
    return true;
};

InputControl.prototype.onDown = function (e) {
    if (this.autoPreventInteraction) {
        e.stopPropagation();
    }

    var mouse = e.data.getLocalPosition(this.pixiText);
    var originalEvent = e.data.originalEvent;
    if (originalEvent.which === 2 || originalEvent.which === 3) {
        originalEvent.preventDefault();
        return false;
    }

    // focus input
    this.focus();

    this._mouseDown = true;

    // start the selection drag if inside the input
    // TODO: move to wrapper
    KeyboardManager.wrapper.selectionStart = this.pixelToTextPos(mouse);
    if (KeyboardManager.wrapper.updateSelection(
            KeyboardManager.wrapper.selectionStart,
            KeyboardManager.wrapper.selectionStart)) {
        this._selectionNeedsUpdate = true;
    }
    this._cursorNeedsUpdate = true;

    this.on('touchend', this.onUp, this);
    this.on('mouseupoutside', this.onUp, this);
    this.on('mouseup', this.onUp, this);

    this.on('mousemove', this.onMove, this);
    this.on('touchmove', this.onMove, this);

    // update the hidden input text, type, maxchars and cursor position
    KeyboardManager.wrapper.text = this.value;
    KeyboardManager.wrapper.cursorPos = KeyboardManager.wrapper.selectionStart;
    KeyboardManager.wrapper.type = this._inputType;
    this.maxChars = this._maxChars;
    this.setCursorPos();

    return true;
};

InputControl.prototype.onUp = function (e) {
    if (this.autoPreventInteraction) {
        e.stopPropagation();
    }

    var originalEvent = e.data.originalEvent;
    if (originalEvent.which === 2 || originalEvent.which === 3) {
        originalEvent.preventDefault();
        return false;
    }

    KeyboardManager.wrapper.selectionStart = 0;
    this._mouseDown = false;

    this.off('touchend', this.onUp, this);
    this.off('mouseupoutside', this.onUp, this);
    this.off('mouseup', this.onUp, this);

    this.off('mousemove', this.onMove, this);
    this.off('touchmove', this.onMove, this);

    return true;
};

/**
 * from position in the text to pixel position
 * (for cursor/selection positioning)
 *
 * @method textToPixelPos
 * @param textPos current character position in the text
 * @returns {Point} pixel position
 */
InputControl.prototype.textToPixelPos = function(textPos, position) {
    var lines = this.getLines();
    var x = 0;
    for (var y = 0; y < lines.length; y++) {
        var lineLength = lines[y].length;
        if (lineLength < textPos) {
            textPos -= lineLength + 1;
        } else {
            var text = lines[y];
            x = this.textWidth(text.substring(0, textPos));
            break;
        }
    }

    if (!position) {
        position = new PIXI.Point(x, y * this.lineHeight());
    } else {
        position.x = x;
        position.y = y * this.lineHeight();
    }
    return position;
};

/**
 * from pixel position on the text to character position inside the text
 * (used when clicked on the text)
 *
 * @method pixelToTextPos
 * @param mousePos position of the mouse on the PIXI Text
 * @returns {Number} position in the text
 */
InputControl.prototype.pixelToTextPos = function(pixelPos) {
    var textPos = 0;
    var lines = this.getLines();
    // calculate current line we are in
    var currentLine = Math.min(
        Math.max(
            parseInt(pixelPos.y / this.lineHeight()),
            0),
        lines.length - 1);
    // sum all characters of previous lines
    for (var i = 0; i < currentLine; i++) {
        textPos += lines[i].length + 1;
    }

    var displayText = lines[currentLine];
    var totalWidth = 0;
    if (pixelPos.x < this.textWidth(displayText)) {
        // loop through each character to identify the position
        for (i = 0; i < displayText.length; i++) {
            totalWidth += this.textWidth(displayText[i]);
            if (totalWidth >= pixelPos.x) {
                textPos += i;
                break;
            }
        }
    } else {
        textPos += displayText.length;
    }
    return textPos;
};

/**
 * callback that will be executed once the text input is blurred
 *
 * @method onblur
 */
InputControl.prototype.onblur = function() {
    this._selectionNeedsUpdate = true;
    this.emit('focusOut', this);
};

// performance increase to avoid using call.. (10x faster)
InputControl.prototype.redrawSkinable = Skinable.prototype.redraw;
InputControl.prototype.redraw = function () {
    // TODO: do NOT use redraw for this but events on the InputWrapper instead!
    if (this.drawCursor) {
        this.drawCursor();
    }
    // TODO: do NOT use redraw for this but events on the InputWrapper instead!
    if (this._selectionNeedsUpdate) {
        this.updateSelectionBg();
    }
    this.redrawSkinable();
};


/**
 * determine if the input has the focus
 *
 * @property hasFocus
 * @type Boolean
 */
Object.defineProperty(InputControl.prototype, 'hasFocus', {
    get: function() {
        return this._hasFocus;
    },
    set: function(focus) {
        this._hasFocus = focus;
    }
});

/**
 * set text style (size, font etc.) for text and cursor
 */
Object.defineProperty(InputControl.prototype, 'style', {
    get: function() {
        return this.textStyle;
    },
    set: function(style) {
        this.cursorStyle = style;
        if (this.cursorView) {
            this.cursorView.style = style;
        }
        this.textStyle = style;
        if (this.pixiText) {
            this.pixiText.style = style;
            this._cursorNeedsUpdate = true;
        }
        this._cursorNeedsUpdate = true;
    }
});

Object.defineProperty(InputControl.prototype, 'restrict', {
    get: function () {
        return this._restrict;
    },
    set: function (regex) {
        this._restrict = regex;
    }
});
/**
 * The current state (one of _validStates)
 * TODO: move to skinable?
 *
 * @property currentState
 * @type String
 */
Object.defineProperty(InputControl.prototype, 'currentState',{
    get: function() {
        return this._currentState;
    },
    set: function(value) {
        if (this._currentState === value) {
            return;
        }
        if (this._validStates.indexOf(value) < 0) {
            throw new Error('Invalid state: ' + value + '.');
        }
        this._currentState = value;
        // invalidate state so the next draw call will redraw the control
        this.invalidState = true;
    }
});
