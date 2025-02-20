import { DxElement } from '../core/element';
import { DxPromise } from '../core/utils/deferred';
import { PositionConfig } from './position';

/**
 * @docid
 * @public
 * @type object
 */
export type AnimationState = string | number | {
    /**
     * @docid
     * @public
     */
    opacity: number;
} | {
    /**
     * @docid
     * @public
     */
    scale: number;
} | {
    /**
     * @docid
     * @public
     */
    position: PositionConfig;
} | {
    /**
    * @docid
    * @public
    */
    left: number;
} | {
    /**
    * @docid
    * @public
    */
    top: number;
};

/**
 * @docid
 * @namespace DevExpress
 * @type object|number|string
 * @public
 */
export type AnimationConfig = {
    /**
     * @docid
     * @public
     */
    complete?: (($element: DxElement, config: AnimationConfig) => void);
    /**
     * @docid
     * @default 0
     * @public
     */
    delay?: number;
    /**
     * @docid
     * @type Enums.Direction
     * @default undefined
     * @public
     */
    direction?: 'bottom' | 'left' | 'right' | 'top';
    /**
     * @docid
     * @default 400
     * @public
     */
    duration?: number;
    /**
     * @docid
     * @default 'ease'
     * @public
     */
    easing?: string;
    /**
     * @docid
     * @default {}
     * @public
     */
    from?: AnimationState;
    /**
     * @docid
     * @default undefined
     * @public
     */
    staggerDelay?: number;
    /**
     * @docid
     * @public
     */
    start?: (($element: DxElement, config: AnimationConfig) => void);
    /**
     * @docid
     * @default {}
     * @public
     */
    to?: AnimationState;
    /**
     * @docid
     * @type Enums.AnimationType
     * @default 'custom'
     * @public
     */
    type?: 'css' | 'fade' | 'fadeIn' | 'fadeOut' | 'pop' | 'slide' | 'slideIn' | 'slideOut';
};

/**
 * @public
 * @deprecated Use the AnimationConfig type instead
 */
export type animationConfig = AnimationConfig;

/**
 * @docid
 * @section utils
 * @namespace DevExpress
 */
declare const fx: {
    /**
     * @docid
     * @publicName animate(element, config)
     * @return Promise<void>
     * @namespace DevExpress.fx
     * @public
     */
    animate(element: Element, config: AnimationConfig): DxPromise<void>;

    /**
     * @docid
     * @publicName isAnimating(element)
     * @namespace DevExpress.fx
     * @public
     */
    isAnimating(element: Element): boolean;

    /**
     * @docid
     * @publicName stop(element, jumpToEnd)
     * @namespace DevExpress.fx
     * @public
     */
    stop(element: Element, jumpToEnd: boolean): void;
};
export default fx;
