/**
 * Gaming UI A11y Toolkit - useFocusable Hook
 *
 * Hook to make an element focusable in the global focus system
 */

import { useRef, useEffect, useCallback } from 'react';
import { useFocusContext } from './useFocusContext';
import type{ UseFocusableOptions, UseFocusableReturn } from '../types/focus.types';

/**
 * Make an element focusable in the global focus management system
 *
 * @param options - Configuration options
 * @returns Object containing focus state and props to spread on the element
 *
 * @example
 * ```tsx
 * function MyButton() {
 *   const focusable = useFocusable({
 *     id: 'my-button',
 *     onActivate: () => console.log('Activated!'),
 *     autoFocus: true,
 *   });
 *
 *   return (
 *     <button {...focusable.focusProps}>
 *       {focusable.isFocused ? 'Focused!' : 'Not focused'}
 *     </button>
 *   );
 * }
 * ```
 */
export const useFocusable = ({
  id,
  group,
  onActivate,
  onNavigate,
  disabled = false,
  autoFocus = false,
  priority,
}: UseFocusableOptions): UseFocusableReturn => {
  const context = useFocusContext();
  const ref = useRef<HTMLElement>(null);
  const isFocused = context.focusedId === id;

  /**
   * Store callbacks in refs to avoid re-registration
   */
  const onActivateRef = useRef(onActivate);
  const onNavigateRef = useRef(onNavigate);

  /**
   * Track if element has been registered
   */
  const isRegistered = useRef(false);

  /**
   * Store context functions in refs to avoid recreating callbacks
   */
  const registerElementRef = useRef(context.registerElement);
  const setFocusRef = useRef(context.setFocus);
  const updateElementPositionRef = useRef(context.updateElementPosition);
  const unregisterRef = useRef(context.unregisterElement);

  useEffect(() => {
    onActivateRef.current = onActivate;
    onNavigateRef.current = onNavigate;
  }, [onActivate, onNavigate]);

  useEffect(() => {
    registerElementRef.current = context.registerElement;
    setFocusRef.current = context.setFocus;
    updateElementPositionRef.current = context.updateElementPosition;
    unregisterRef.current = context.unregisterElement;
  }, [context]);

  /**
   * Update element registration when properties change
   */
  useEffect(() => {
    if (isRegistered.current && ref.current && !disabled) {
      const position = ref.current.getBoundingClientRect();

      registerElementRef.current({
        id,
        ref,
        group,
        position,
        onActivate: (...args) => onActivateRef.current?.(...args),
        onNavigate: (...args) => onNavigateRef.current?.(...args) ?? false,
        disabled,
        priority,
      });
    }
  }, [id, group, disabled, priority]);

  /**
   * Unregister element on unmount or id change
   */
  useEffect(() => {
    return () => {
      unregisterRef.current(id);
      isRegistered.current = false;
    };
  }, [id]);

  /**
   * Update position on resize and scroll
   */
  useEffect(() => {
    if (disabled) return;

    const updatePosition = () => {
      if (ref.current) {
        const position = ref.current.getBoundingClientRect();
        updateElementPositionRef.current(id, position);
      }
    };

    // Update position periodically and on scroll/resize
    const interval = setInterval(updatePosition, 1000);

    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition, true);

    return () => {
      clearInterval(interval);
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
    };
  }, [id, disabled]);

  /**
   * Handle DOM ref callback
   */
  const handleRef = useCallback((element: HTMLElement | null) => {
    (ref as React.MutableRefObject<HTMLElement | null>).current = element;

    // Register element when ref is first set
    if (element && !isRegistered.current && !disabled) {
      const position = element.getBoundingClientRect();

      registerElementRef.current({
        id,
        ref,
        group,
        position,
        onActivate: (...args) => onActivateRef.current?.(...args),
        onNavigate: (...args) => onNavigateRef.current?.(...args) ?? false,
        disabled,
        priority,
      });

      isRegistered.current = true;

      // Auto-focus if requested
      if (autoFocus) {
        setFocusRef.current(id);
      }
    } else if (element && isRegistered.current) {
      // Just update position if already registered
      const position = element.getBoundingClientRect();
      updateElementPositionRef.current(id, position);
    }
  }, [id, group, disabled, autoFocus, priority]);

  /**
   * Handle focus event
   */
  const handleFocus = useCallback(() => {
    if (!disabled) {
      setFocusRef.current(id);
    }
  }, [id, disabled]);

  /**
   * Handle click event
   */
  const handleClick = useCallback(() => {
    if (!disabled) {
      // Set focus first
      setFocusRef.current(id);
      // Then activate
      onActivateRef.current?.();
    }
  }, [id, disabled]);

  /**
   * Programmatically focus this element
   */
  const focus = useCallback(() => {
    setFocusRef.current(id);
  }, [id]);

  return {
    isFocused,
    focusProps: {
      ref: handleRef,
      'data-focusable-id': id,
      'data-focused': isFocused,
      'aria-current': isFocused ? 'true' : undefined,
      tabIndex: isFocused ? 0 : -1,
      onFocus: handleFocus,
      onClick: handleClick,
    },
    focus,
  };
};
