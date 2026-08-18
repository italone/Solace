import type { ComponentEventMap } from "./component/component";
import type { ComponentType, VNodeChild, VNodeProps, VNodeSlots } from "./vnode/vnode";

export type JSXChild = VNodeChild | number | boolean | null | undefined;
export type JSXChildren = JSXChild | JSXChild[];
export type JSXKey = string | number;

type JSXEventHandler = (...args: never[]) => unknown;
type JSXEventHandlerValue = JSXEventHandler | JSXEventHandler[];
type JSXDomEventHandler = (...args: never[]) => unknown;

export type JSXElementProps = VNodeProps & {
  children?: JSXChildren;
} & {
  [eventHandler in `on${string}`]?: JSXDomEventHandler;
};

type AsciiLowercaseLetter =
  | "a"
  | "b"
  | "c"
  | "d"
  | "e"
  | "f"
  | "g"
  | "h"
  | "i"
  | "j"
  | "k"
  | "l"
  | "m"
  | "n"
  | "o"
  | "p"
  | "q"
  | "r"
  | "s"
  | "t"
  | "u"
  | "v"
  | "w"
  | "x"
  | "y"
  | "z";
type AsciiDigit = "0" | "1" | "2" | "3" | "4" | "5" | "6" | "7" | "8" | "9";
type AsciiWordCharacter = AsciiLowercaseLetter | Uppercase<AsciiLowercaseLetter> | AsciiDigit | "_";

type CamelizeEventName<Value extends string> =
  Value extends `${infer Head}-${infer Character}${infer Tail}`
    ? Character extends AsciiWordCharacter
      ? `${Head}${Uppercase<Character>}${CamelizeEventName<Tail>}`
      : `${Head}-${CamelizeEventName<`${Character}${Tail}`>}`
    : Value;

type EventListenerKey<Event extends string> = `on${Capitalize<CamelizeEventName<Event>>}`;
type EventArgs<
  Events extends ComponentEventMap,
  Event extends keyof Events,
> = Events[Event] extends readonly [...infer Args] ? Args : never;
type EventListener<Args extends unknown[]> = (...args: Args) => unknown;
type EventListenerValue<Args extends unknown[]> = EventListener<Args> | EventListener<Args>[];

type PermissiveComponentListenerProps = {
  [eventHandler in `on${string}`]?: JSXEventHandlerValue;
};
type StrictComponentListenerProps<Events extends ComponentEventMap> = {
  [Event in keyof Events & string as EventListenerKey<Event>]?: EventListenerValue<
    EventArgs<Events, Event>
  >;
};
type ComponentListenerProps<Events extends ComponentEventMap> = string extends keyof Events
  ? PermissiveComponentListenerProps
  : StrictComponentListenerProps<Events>;
type ComponentPropsWithListeners<
  Props extends object,
  Events extends ComponentEventMap,
> = string extends keyof Events
  ? Props & ComponentListenerProps<Events>
  : Omit<Props, keyof ComponentListenerProps<Events>> & ComponentListenerProps<Events>;

export type JSXComponentProps<
  Props extends object,
  Events extends ComponentEventMap = ComponentEventMap,
  SlotMap extends object = Record<string, unknown>,
> = ComponentPropsWithListeners<Props, Events> & JSXSlotChildren<SlotMap> & JSXSlotProps<SlotMap>;

type JSXSlotProps<SlotMap extends object> = string extends keyof SlotMap
  ? { "v-slots"?: VNodeSlots }
  : { "v-slots"?: Partial<SlotMap> };

type JSXSlotChildren<SlotMap extends object> = string extends keyof SlotMap
  ? { children?: JSXChildren }
  : "default" extends keyof SlotMap
    ? undefined extends SlotMap["default"]
      ? { children?: JSXChildren }
      : { children: JSXChildren }
    : { children?: never };

export type JSXManagedComponentProps<Component, Props> = Props extends object
  ? Component extends ComponentType<never, infer Events, infer SlotMap>
    ? JSXComponentProps<Props, Events, SlotMap>
    : JSXComponentProps<Props, ComponentEventMap>
  : Props;

export type JSXProps =
  JSXElementProps | JSXComponentProps<object, ComponentEventMap> | { children?: JSXChildren };
