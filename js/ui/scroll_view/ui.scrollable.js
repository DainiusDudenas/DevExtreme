import { getHeight, getOuterHeight, getWidth, getOuterWidth } from '../../core/utils/size';
import $ from '../../core/renderer';
import eventsEngine from '../../events/core/events_engine';
import { nativeScrolling } from '../../core/utils/support';
import browser from '../../core/utils/browser';
import { ensureDefined } from '../../core/utils/common';
import { isPlainObject, isDefined } from '../../core/utils/type';
import { extend } from '../../core/utils/extend';
import { getPublicElement } from '../../core/element';
import { hasWindow } from '../../core/utils/window';
import devices from '../../core/devices';
import registerComponent from '../../core/component_registrator';
import DOMComponent from '../../core/dom_component';
import { addNamespace } from '../../events/utils/index';
import scrollEvents from '../../events/gesture/emitter.gesture.scroll';
import { SimulatedStrategy } from './ui.scrollable.simulated';
import NativeStrategy from './ui.scrollable.native';
import { deviceDependentOptions } from './ui.scrollable.device';
import { when } from '../../core/utils/deferred';
import getScrollRtlBehavior from '../../core/utils/scroll_rtl_behavior';
import { getElementLocationInternal } from '../../renovation/ui/scroll_view/utils/get_element_location_internal';

const SCROLLABLE = 'dxScrollable';
const SCROLLABLE_STRATEGY = 'dxScrollableStrategy';
const SCROLLABLE_CLASS = 'dx-scrollable';
const SCROLLABLE_DISABLED_CLASS = 'dx-scrollable-disabled';
const SCROLLABLE_CONTAINER_CLASS = 'dx-scrollable-container';
const SCROLLABLE_WRAPPER_CLASS = 'dx-scrollable-wrapper';
const SCROLLABLE_CONTENT_CLASS = 'dx-scrollable-content';
const VERTICAL = 'vertical';
const HORIZONTAL = 'horizontal';
const BOTH = 'both';

const Scrollable = DOMComponent.inherit({

    _getDefaultOptions: function() {
        return extend(this.callBase(), {
            disabled: false,
            onScroll: null,
            direction: VERTICAL,
            showScrollbar: 'onScroll',
            useNative: true,
            bounceEnabled: true,
            scrollByContent: true,
            scrollByThumb: false,
            onUpdated: null,
            onStart: null,
            onEnd: null,
            onBounce: null,
            useSimulatedScrollbar: false,
            useKeyboard: true,
            inertiaEnabled: true,
            updateManually: false
        });
    },

    _defaultOptionsRules: function() {
        return this.callBase().concat(deviceDependentOptions(), [
            {
                device: function() {
                    return nativeScrolling && devices.real().platform === 'android' && !browser.mozilla;
                },
                options: {
                    useSimulatedScrollbar: true
                }
            }
        ]);
    },

    _initOptions: function(options) {
        this.callBase(options);
        if(!('useSimulatedScrollbar' in options)) {
            this._setUseSimulatedScrollbar();
        }
    },

    _setUseSimulatedScrollbar: function() {
        if(!this.initialOption('useSimulatedScrollbar')) {
            this.option('useSimulatedScrollbar', !this.option('useNative'));
        }
    },

    _init: function() {
        this.callBase();
        this._initScrollableMarkup();
        this._locked = false;
    },

    _visibilityChanged: function(visible) {
        if(visible) {
            this.update();
            this._updateRtlPosition();
            this._savedScrollOffset && this.scrollTo(this._savedScrollOffset);
            delete this._savedScrollOffset;
        } else {
            this._savedScrollOffset = this.scrollOffset();
        }
    },

    _initScrollableMarkup: function() {
        const $element = this.$element().addClass(SCROLLABLE_CLASS);
        const $container = this._$container = $('<div>').addClass(SCROLLABLE_CONTAINER_CLASS);
        const $wrapper = this._$wrapper = $('<div>').addClass(SCROLLABLE_WRAPPER_CLASS);
        const $content = this._$content = $('<div>').addClass(SCROLLABLE_CONTENT_CLASS);

        $content.append($element.contents()).appendTo($container);
        $container.appendTo($wrapper);
        $wrapper.appendTo($element);
    },

    _dimensionChanged: function() {
        this.update();
        this._updateRtlPosition();
    },

    _initMarkup: function() {
        this.callBase();
        this._renderDirection();
    },

    _render: function() {
        this._renderStrategy();

        this._attachEventHandlers();
        this._renderDisabledState();
        this._createActions();
        this.update();

        this.callBase();

        this._updateRtlPosition(true);
    },

    _updateRtlPosition: function(needInitializeRtlConfig) {
        this._strategy.updateRtlPosition(needInitializeRtlConfig);
    },

    _getMaxOffset: function() {
        const { scrollWidth, clientWidth, scrollHeight, clientHeight } = $(this.container()).get(0);

        return {
            left: scrollWidth - clientWidth,
            top: scrollHeight - clientHeight,
        };
    },

    _attachEventHandlers: function() {
        const strategy = this._strategy;

        const initEventData = {
            getDirection: strategy.getDirection.bind(strategy),
            validate: this._validate.bind(this),
            isNative: this.option('useNative'),
            scrollTarget: this._$container
        };

        eventsEngine.off(this._$wrapper, '.' + SCROLLABLE);
        eventsEngine.on(this._$wrapper, addNamespace(scrollEvents.init, SCROLLABLE), initEventData, this._initHandler.bind(this));
        eventsEngine.on(this._$wrapper, addNamespace(scrollEvents.start, SCROLLABLE), strategy.handleStart.bind(strategy));
        eventsEngine.on(this._$wrapper, addNamespace(scrollEvents.move, SCROLLABLE), strategy.handleMove.bind(strategy));
        eventsEngine.on(this._$wrapper, addNamespace(scrollEvents.end, SCROLLABLE), strategy.handleEnd.bind(strategy));
        eventsEngine.on(this._$wrapper, addNamespace(scrollEvents.cancel, SCROLLABLE), strategy.handleCancel.bind(strategy));
        eventsEngine.on(this._$wrapper, addNamespace(scrollEvents.stop, SCROLLABLE), strategy.handleStop.bind(strategy));

        eventsEngine.off(this._$container, '.' + SCROLLABLE);
        eventsEngine.on(this._$container, addNamespace('scroll', SCROLLABLE), strategy.handleScroll.bind(strategy));
    },

    _validate: function(e) {
        if(this._isLocked()) {
            return false;
        }

        this._updateIfNeed();

        return this._moveIsAllowed(e);
    },

    _moveIsAllowed(e) {
        return this._strategy.validate(e);
    },

    handleMove(e) {
        this._strategy.handleMove(e);
    },

    _prepareDirections(value) {
        this._strategy._prepareDirections(value);
    },

    _initHandler: function() {
        const strategy = this._strategy;
        strategy.handleInit.apply(strategy, arguments);
    },

    _renderDisabledState: function() {
        this.$element().toggleClass(SCROLLABLE_DISABLED_CLASS, this.option('disabled'));

        if(this.option('disabled')) {
            this._lock();
        } else {
            this._unlock();
        }
    },

    _renderDirection: function() {
        this.$element()
            .removeClass('dx-scrollable-' + HORIZONTAL)
            .removeClass('dx-scrollable-' + VERTICAL)
            .removeClass('dx-scrollable-' + BOTH)
            .addClass('dx-scrollable-' + this.option('direction'));
    },

    _renderStrategy: function() {
        this._createStrategy();
        this._strategy.render();
        this.$element().data(SCROLLABLE_STRATEGY, this._strategy);
    },

    _createStrategy: function() {
        this._strategy = (this.option('useNative'))
            ? new NativeStrategy(this)
            : new SimulatedStrategy(this);
    },

    _createActions: function() {
        this._strategy && this._strategy.createActions();
    },

    _clean: function() {
        this._strategy && this._strategy.dispose();
    },

    _optionChanged: function(args) {
        switch(args.name) {
            case 'onStart':
            case 'onEnd':
            case 'onUpdated':
            case 'onScroll':
            case 'onBounce':
                this._createActions();
                break;
            case 'direction':
                this._resetInactiveDirection();
                this._invalidate();
                break;
            case 'useNative':
                this._setUseSimulatedScrollbar();
                this._invalidate();
                break;
            case 'inertiaEnabled':
            case 'scrollByContent':
            case 'scrollByThumb':
            case 'bounceEnabled':
            case 'useKeyboard':
            case 'showScrollbar':
            case 'useSimulatedScrollbar':
                this._invalidate();
                break;
            case 'disabled':
                this._renderDisabledState();
                this._strategy && this._strategy.disabledChanged();
                break;
            case 'updateManually':
                break;
            case 'width':
                this.callBase(args);
                this._updateRtlPosition();
                break;
            default:
                this.callBase(args);
        }
    },

    _resetInactiveDirection: function() {
        const inactiveProp = this._getInactiveProp();
        if(!inactiveProp || !hasWindow()) {
            return;
        }

        const scrollOffset = this.scrollOffset();
        scrollOffset[inactiveProp] = 0;
        this.scrollTo(scrollOffset);
    },

    _getInactiveProp: function() {
        const direction = this.option('direction');
        if(direction === VERTICAL) {
            return 'left';
        }
        if(direction === HORIZONTAL) {
            return 'top';
        }
    },

    _location: function() {
        return this._strategy.location();
    },

    _normalizeLocation: function(location) {
        if(isPlainObject(location)) {
            const left = ensureDefined(location.left, location.x);
            const top = ensureDefined(location.top, location.y);
            return {
                left: isDefined(left) ? -left : undefined,
                top: isDefined(top) ? -top : undefined
            };
        } else {
            const direction = this.option('direction');
            return {
                left: direction !== VERTICAL ? -location : undefined,
                top: direction !== HORIZONTAL ? -location : undefined
            };
        }
    },

    _isLocked: function() {
        return this._locked;
    },

    _lock: function() {
        this._locked = true;
    },

    _unlock: function() {
        if(!this.option('disabled')) {
            this._locked = false;
        }
    },

    _isDirection: function(direction) {
        const current = this.option('direction');
        if(direction === VERTICAL) {
            return current !== HORIZONTAL;
        }
        if(direction === HORIZONTAL) {
            return current !== VERTICAL;
        }
        return current === direction;
    },

    _updateAllowedDirection: function() {
        const allowedDirections = this._strategy._allowedDirections();

        if(this._isDirection(BOTH) && allowedDirections.vertical && allowedDirections.horizontal) {
            this._allowedDirectionValue = BOTH;
        } else if(this._isDirection(HORIZONTAL) && allowedDirections.horizontal) {
            this._allowedDirectionValue = HORIZONTAL;
        } else if(this._isDirection(VERTICAL) && allowedDirections.vertical) {
            this._allowedDirectionValue = VERTICAL;
        } else {
            this._allowedDirectionValue = null;
        }
    },

    _allowedDirection: function() {
        return this._allowedDirectionValue;
    },

    $content: function() {
        return this._$content;
    },

    content: function() {
        return getPublicElement(this._$content);
    },

    container: function() {
        return getPublicElement(this._$container);
    },

    scrollOffset: function() {
        return this._strategy._getScrollOffset();
    },

    _isRtlNativeStrategy: function() {
        const { useNative, rtlEnabled } = this.option();

        return useNative && rtlEnabled;
    },

    scrollTop: function() {
        return this.scrollOffset().top;
    },

    scrollLeft: function() {
        return this.scrollOffset().left;
    },

    clientHeight: function() {
        return getHeight(this._$container);
    },

    scrollHeight: function() {
        return getOuterHeight(this.$content());
    },

    clientWidth: function() {
        return getWidth(this._$container);
    },

    scrollWidth: function() {
        return getOuterWidth(this.$content());
    },

    update: function() {
        if(!this._strategy) {
            return;
        }
        return when(this._strategy.update()).done((function() {
            this._updateAllowedDirection();
        }).bind(this));
    },

    scrollBy: function(distance) {
        distance = this._normalizeLocation(distance);

        if(!distance.top && !distance.left) {
            return;
        }

        this._updateIfNeed();
        this._strategy.scrollBy(distance);
    },

    scrollTo: function(targetLocation) {
        targetLocation = this._normalizeLocation(targetLocation);

        this._updateIfNeed();

        let location = this._location();

        if(!this.option('useNative')) {
            targetLocation = this._strategy._applyScaleRatio(targetLocation);
            location = this._strategy._applyScaleRatio(location);
        }

        if(this._isScrollInverted()) {
            location.left = this._getScrollSign() * location.left - this._getMaxOffset().left;
        }

        const distance = this._normalizeLocation({
            left: location.left - ensureDefined(targetLocation.left, location.left),
            top: location.top - ensureDefined(targetLocation.top, location.top)
        });

        if(!distance.top && !distance.left) {
            return;
        }

        this._strategy.scrollBy(distance);
    },

    _getScrollSign() {
        return getScrollRtlBehavior().positive ? -1 : 1;
    },

    _isScrollInverted: function() {
        const { rtlEnabled, useNative } = this.option();
        const { decreasing, positive } = getScrollRtlBehavior();

        return useNative && rtlEnabled && (decreasing ^ positive);
    },

    scrollToElement: function(element, offset) {
        const $element = $(element);
        const elementInsideContent = this.$content().find(element).length;
        const elementIsInsideContent = ($element.parents('.' + SCROLLABLE_CLASS).length - $element.parents('.' + SCROLLABLE_CONTENT_CLASS).length) === 0;
        if(!elementInsideContent || !elementIsInsideContent) {
            return;
        }

        const scrollPosition = { top: 0, left: 0 };
        const direction = this.option('direction');

        if(direction !== VERTICAL) {
            scrollPosition.left = this.getScrollElementPosition($element, HORIZONTAL, offset);
        }
        if(direction !== HORIZONTAL) {
            scrollPosition.top = this.getScrollElementPosition($element, VERTICAL, offset);
        }

        this.scrollTo(scrollPosition);
    },

    getScrollElementPosition: function($element, direction, offset) {
        const scrollOffset = this.scrollOffset();

        return getElementLocationInternal(
            $element.get(0),
            direction,
            $(this.container()).get(0),
            scrollOffset,
            offset,
        );
    },

    _updateIfNeed: function() {
        if(!this.option('updateManually')) {
            this.update();
        }
    },

    _useTemplates: function() {
        return false;
    },

    isRenovated: function() {
        return !!Scrollable.IS_RENOVATED_WIDGET;
    }
});

registerComponent(SCROLLABLE, Scrollable);

export default Scrollable;
