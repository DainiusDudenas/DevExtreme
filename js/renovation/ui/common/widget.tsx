import {
  Component,
  ComponentBindings,
  Effect,
  Event,
  InternalState,
  JSXComponent,
  Method,
  OneWay,
  Ref,
  Slot,
  Consumer,
  ForwardRef,
  RefObject,
} from '@devextreme-generator/declarations';
import '../../../events/click';
import '../../../events/hover';

import { isFunction } from '../../../core/utils/type';
import {
  active, dxClick, focus, hover, keyboard, resize, visibility,
} from '../../../events/short';
import { combineClasses } from '../../utils/combine_classes';
import { extend } from '../../../core/utils/extend';
import { focusable } from '../../../ui/widget/selectors';
import { normalizeStyleProp } from '../../../core/utils/style';
import { BaseWidgetProps } from './base_props';
import { EffectReturn } from '../../utils/effect_return';
import { ConfigContextValue, ConfigContext } from '../../common/config_context';
import { ConfigProvider } from '../../common/config_provider';
import { resolveRtlEnabled, resolveRtlEnabledDefinition } from '../../utils/resolve_rtl';
import resizeCallbacks from '../../../core/utils/resize_callbacks';
import errors from '../../../core/errors';
import domAdapter from '../../../core/dom_adapter';

const DEFAULT_FEEDBACK_HIDE_TIMEOUT = 400;
const DEFAULT_FEEDBACK_SHOW_TIMEOUT = 30;

const getAria = (args: Record<string, unknown>): Record<string, string> => Object
  .keys(args)
  .reduce((r, key) => {
    if (args[key]) {
      return {
        ...r,
        [key === 'role' || key === 'id' ? key : `aria-${key}`]: String(args[key]),
      };
    }
    return r;
  }, {});

export const viewFunction = (viewModel: Widget): JSX.Element => {
  const widget = (
    <div
      ref={viewModel.widgetElementRef}
      {...viewModel.attributes} // eslint-disable-line react/jsx-props-no-spreading
      tabIndex={viewModel.tabIndex}
      title={viewModel.props.hint}
      hidden={!viewModel.props.visible}
      className={viewModel.cssClasses}
      style={viewModel.styles}
    >
      {viewModel.props.children}
    </div>
  );
  return (
    viewModel.shouldRenderConfigProvider
      ? (
        <ConfigProvider rtlEnabled={viewModel.rtlEnabled}>
          {widget}
        </ConfigProvider>
      )
      : widget
  );
};

@ComponentBindings()
export class WidgetProps extends BaseWidgetProps {
  @ForwardRef() rootElementRef?: RefObject<HTMLDivElement>;

  @OneWay() _feedbackHideTimeout?: number = DEFAULT_FEEDBACK_HIDE_TIMEOUT;

  @OneWay() _feedbackShowTimeout?: number = DEFAULT_FEEDBACK_SHOW_TIMEOUT;

  @OneWay() activeStateUnit?: string;

  @OneWay() cssText = '';

  @OneWay() aria?: Record<string, string> = {};

  @Slot() children?: JSX.Element | (JSX.Element | undefined | false | null)[];

  @OneWay() classes?: string | undefined = '';

  @OneWay() name?: string = '';

  @OneWay() addWidgetClass? = true;

  @Event() onActive?: (e: Event) => void;

  @Event() onDimensionChanged?: () => void;

  @Event() onInactive?: (e: Event) => void;

  @Event() onVisibilityChange?: (args: boolean) => void;

  @Event() onFocusIn?: (e: Event) => void;

  @Event() onFocusOut?: (e: Event) => void;

  @Event() onHoverStart?: (e: Event) => void;

  @Event() onHoverEnd?: (e: Event) => void;

  @Event() onRootElementRendered?: (rootElement: HTMLDivElement) => void;
}

@Component({
  defaultOptionRules: null,
  jQuery: {
    register: true,
  },
  view: viewFunction,
})

export class Widget extends JSXComponent(WidgetProps) {
  @InternalState() active = false;

  @InternalState() focused = false;

  @InternalState() hovered = false;

  @Ref()
  widgetElementRef!: RefObject<HTMLDivElement>;

  @Consumer(ConfigContext)
  config?: ConfigContextValue;

  get shouldRenderConfigProvider(): boolean {
    const { rtlEnabled } = this.props;
    return resolveRtlEnabledDefinition(rtlEnabled, this.config);
  }

  get rtlEnabled(): boolean | undefined {
    const { rtlEnabled } = this.props;
    return resolveRtlEnabled(rtlEnabled, this.config);
  }

  @Effect({ run: 'once' }) setRootElementRef(): void {
    const { rootElementRef, onRootElementRendered } = this.props;
    if (rootElementRef) {
      rootElementRef.current = this.widgetElementRef.current;
    }
    onRootElementRendered?.(this.widgetElementRef.current!);
  }

  @Effect()
  activeEffect(): EffectReturn {
    const {
      activeStateEnabled, activeStateUnit, disabled, onInactive,
      // eslint-disable-next-line @typescript-eslint/naming-convention
      _feedbackShowTimeout, _feedbackHideTimeout, onActive,
    } = this.props;
    const selector = activeStateUnit;
    const namespace = 'UIFeedback';

    if (activeStateEnabled && !disabled) {
      active.on(this.widgetElementRef.current,
        ({ event }: { event: Event }) => {
          this.active = true;
          onActive?.(event);
        },
        ({ event }: { event: Event }) => {
          this.active = false;
          onInactive?.(event);
        }, {
          hideTimeout: _feedbackHideTimeout,
          namespace,
          selector,
          showTimeout: _feedbackShowTimeout,
        });

      return (): void => active.off(this.widgetElementRef.current, { selector, namespace });
    }

    return undefined;
  }

  @Effect()
  clickEffect(): EffectReturn {
    const { name, onClick, disabled } = this.props;
    const namespace = name;

    if (onClick && !disabled) {
      dxClick.on(this.widgetElementRef.current, onClick, { namespace });
      return (): void => dxClick.off(this.widgetElementRef.current, { namespace });
    }

    return undefined;
  }

  @Method()
  focus(): void {
    focus.trigger(this.widgetElementRef.current);
  }

  @Method()
  blur(): void {
    const activeElement = domAdapter.getActiveElement();

    if (this.widgetElementRef.current === activeElement) {
      activeElement.blur();
    }
  }

  @Method()
  activate(): void {
    this.active = true;
  }

  @Method()
  deactivate(): void {
    this.active = false;
  }

  @Effect()
  focusEffect(): EffectReturn {
    const {
      disabled, focusStateEnabled, name, onFocusIn, onFocusOut,
    } = this.props;
    const namespace = `${name}Focus`;
    const isFocusable = focusStateEnabled && !disabled;

    if (isFocusable) {
      focus.on(this.widgetElementRef.current,
        (e: Event & { isDefaultPrevented: () => boolean }) => {
          if (!e.isDefaultPrevented()) {
            this.focused = true;
            onFocusIn?.(e);
          }
        },
        (e: Event & { isDefaultPrevented: () => boolean }) => {
          if (!e.isDefaultPrevented()) {
            this.focused = false;
            onFocusOut?.(e);
          }
        },
        {
          isFocusable: focusable,
          namespace,
        });
      return (): void => focus.off(this.widgetElementRef.current, { namespace });
    }

    return undefined;
  }

  @Effect()
  hoverEffect(): EffectReturn {
    const namespace = 'UIFeedback';
    const {
      activeStateUnit, hoverStateEnabled, disabled, onHoverStart, onHoverEnd,
    } = this.props;
    const selector = activeStateUnit;
    const isHoverable = hoverStateEnabled && !disabled;
    if (isHoverable) {
      hover.on(this.widgetElementRef.current,
        ({ event }: { event: Event }) => {
          !this.active && (this.hovered = true);
          onHoverStart?.(event);
        },
        (event: Event) => {
          this.hovered = false;
          onHoverEnd?.(event);
        },
        { selector, namespace });
      return (): void => hover.off(this.widgetElementRef.current, { selector, namespace });
    }

    return undefined;
  }

  @Effect()
  keyboardEffect(): EffectReturn {
    const { onKeyDown, focusStateEnabled } = this.props;

    if (focusStateEnabled && onKeyDown) {
      const id = keyboard.on(
        this.widgetElementRef.current,
        this.widgetElementRef.current,
        (e: Event): void => onKeyDown(e) as undefined,
      );

      return (): void => keyboard.off(id);
    }

    return undefined;
  }

  @Effect()
  resizeEffect(): EffectReturn {
    const namespace = `${this.props.name}VisibilityChange`;
    const { onDimensionChanged } = this.props;

    if (onDimensionChanged) {
      resize.on(this.widgetElementRef.current, onDimensionChanged, { namespace });
      return (): void => resize.off(this.widgetElementRef.current, { namespace });
    }

    return undefined;
  }

  @Effect() windowResizeEffect(): EffectReturn {
    const { onDimensionChanged } = this.props;

    if (onDimensionChanged) {
      resizeCallbacks.add(onDimensionChanged);

      return (): void => { resizeCallbacks.remove(onDimensionChanged); };
    }

    return undefined;
  }

  @Effect()
  visibilityEffect(): EffectReturn {
    const { name, onVisibilityChange } = this.props;
    const namespace = `${name}VisibilityChange`;

    if (onVisibilityChange) {
      visibility.on(this.widgetElementRef.current,
        (): void => onVisibilityChange(true),
        (): void => onVisibilityChange(false),
        { namespace });

      return (): void => visibility.off(this.widgetElementRef.current, { namespace });
    }

    return undefined;
  }

  @Effect()
  checkDeprecation(): void {
    const { width, height } = this.props;
    if (isFunction(width)) {
      errors.log('W0017', 'width');
    }
    if (isFunction(height)) {
      errors.log('W0017', 'height');
    }
  }

  @Effect()
  applyCssTextEffect(): void {
    const { cssText } = this.props;

    if (cssText !== '') {
      this.widgetElementRef.current!.style.cssText = cssText;
    }
  }

  get attributes(): Record<string, string> {
    const {
      aria,
      disabled,
      focusStateEnabled,
      visible,
    } = this.props;

    const accessKey = focusStateEnabled && !disabled && this.props.accessKey;
    return {
      ...extend({}, this.restAttributes, accessKey && { accessKey }) as Record<string, string>,
      ...getAria({ ...aria, disabled, hidden: !visible }),
    };
  }

  get styles(): Record<string, string | number> {
    const { width, height } = this.props;
    const style = this.restAttributes.style as Record<string, string | number> || {};
    const computedWidth = normalizeStyleProp('width', isFunction(width) ? width() : width);
    const computedHeight = normalizeStyleProp('height', isFunction(height) ? height() : height);

    return {
      ...style,
      height: computedHeight ?? style.height,
      width: computedWidth ?? style.width,
    };
  }

  get cssClasses(): string {
    const {
      classes,
      addWidgetClass,
      className,
      disabled,
      activeStateEnabled,
      focusStateEnabled,
      hoverStateEnabled,
      onVisibilityChange,
      visible,
    } = this.props;

    const isFocusable = !!focusStateEnabled && !disabled;
    const isHoverable = !!hoverStateEnabled && !disabled;
    const canBeActive = !!activeStateEnabled && !disabled;
    const classesMap = {
      'dx-widget': !!addWidgetClass,
      [String(classes)]: !!classes,
      [String(className)]: !!className,
      'dx-state-disabled': !!disabled,
      'dx-state-invisible': !visible,
      'dx-state-focused': !!this.focused && isFocusable,
      'dx-state-active': !!this.active && canBeActive,
      'dx-state-hover': !!this.hovered && isHoverable && !this.active,
      'dx-rtl': !!this.rtlEnabled,
      'dx-visibility-change-handler': !!onVisibilityChange,
    };

    return combineClasses(classesMap);
  }

  get tabIndex(): undefined | number {
    const { focusStateEnabled, disabled, tabIndex } = this.props;
    const isFocusable = focusStateEnabled && !disabled;

    return isFocusable ? tabIndex : undefined;
  }
}
