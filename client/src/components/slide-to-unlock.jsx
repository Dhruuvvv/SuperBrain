"use client";
import { createContext, useCallback, useContext, useRef, useState } from "react"
import { animate, motion, useMotionValue, useTransform } from "motion/react";

import { cn } from "lib/utils"

const SlideToUnlockContext = createContext(null)

function useSlideToUnlock() {
  const context = useContext(SlideToUnlockContext)
  if (!context) {
    throw new Error(`SlideToUnlock components must be used within SlideToUnlock`)
  }
  return context
}

export function SlideToUnlock({
  className,
  handleWidth = 56,
  children,
  onUnlock,
  disabled = false,
  ...props
}) {
  const trackRef = useRef(null)
  const [isDragging, setIsDragging] = useState(false)
  const x = useMotionValue(0)

  const fadeDistance = handleWidth
  const textOpacity = useTransform(x, [0, fadeDistance], [1, 0])

  const handleDragStart = useCallback(() => {
    setIsDragging(true)
  }, [])

  const handleDragEnd = useCallback(() => {
    setIsDragging(false)

    const trackWidth = trackRef.current?.offsetWidth || 0
    const maxX = trackWidth - handleWidth

    if (x.get() >= maxX) {
      onUnlock?.()
    } else {
      animate(x, 0, { type: "spring", bounce: 0, duration: 0.25 })
    }
  }, [x, onUnlock, handleWidth])

  return (
      <SlideToUnlockContext.Provider
        value={{
          x,
          trackRef,
          isDragging,
          handleWidth,
          textOpacity,
          disabled,
          onDragStart: handleDragStart,
          onDragEnd: handleDragEnd,
        }}>
      <div
        data-slot="slide-to-unlock"
        className={cn(
          "w-54 rounded-xl bg-muted p-1 shadow-inner inset-ring-1 inset-ring-foreground/10",
          className
        )}
        {...props}>
        {children}
      </div>
    </SlideToUnlockContext.Provider>
  );
}

export function SlideToUnlockTrack({
  className,
  children,
  ...props
}) {
  const { trackRef } = useSlideToUnlock()

  return (
    <div
      ref={trackRef}
      data-slot="track"
      className={cn("relative flex h-10 items-center justify-center", className)}
      {...props}>
      {children}
    </div>
  );
}

export function SlideToUnlockText({
  className,
  children,
  style,
  ...props
}) {
  const { handleWidth, textOpacity, isDragging } = useSlideToUnlock()

  return (
    <motion.div
      data-slot="text"
      data-dragging={isDragging}
      className={cn("pl-1 text-lg font-medium", className)}
      style={{ marginLeft: handleWidth, opacity: textOpacity, ...style }}
      {...props}>
      {typeof children === "function" ? children({ isDragging }) : children}
    </motion.div>
  );
}

export function SlideToUnlockHandle({
  className,
  children,
  style,
  ...props
}) {
  const {
    x,
    trackRef,
    onDragStart,
    onDragEnd,
    handleWidth: width,
    disabled,
  } = useSlideToUnlock()

  return (
    <motion.div
      data-slot="handle"
      className={cn(
        "absolute top-0 left-0 flex h-10 cursor-grab items-center justify-center rounded-lg bg-white text-zinc-400 shadow-sm active:cursor-grabbing",
        "[&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-6",
        className
      )}
      style={{ width, x, ...style }}
      drag={disabled ? false : "x"}
      dragConstraints={trackRef}
      dragElastic={0}
      dragMomentum={false}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      {...props}>
      {children ?? (
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" aria-hidden>
          <path d="M24 12 12.75 3v4.696H0v8.608h12.75V21z" fill="currentColor" />
        </svg>
      )}
    </motion.div>
  );
}
