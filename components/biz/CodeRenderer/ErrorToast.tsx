import { FC, useEffect, useState } from "react"
import { cn } from "@/lib/utils"
import { ScrollArea } from "@/components/ui/scroll-area"

interface ErrorToastProps {
  message: string
  onFix: () => void
  className?: string
}

export const ErrorToast: FC<ErrorToastProps> = ({
  message,
  onFix,
  className,
}) => {
  const [position, setPosition] = useState({ x: 0, y: 0 })
  const [dragging, setDragging] = useState(false)
  const [offset, setOffset] = useState({ x: 0, y: 0 })

  // 处理鼠标按下事件
  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    setDragging(true)
    setOffset({
      x: e.clientX - position.x,
      y: e.clientY - position.y,
    })
  }

  // 处理鼠标移动事件
  const handleMouseMove = (e: MouseEvent) => {
    if (dragging) {
      const newX = e.clientX - offset.x
      const newY = e.clientY - offset.y
      setPosition({
        x: Math.max(0, Math.min(window.innerWidth - 320, newX)),
        y: Math.max(0, Math.min(window.innerHeight - 200, newY)),
      })
    }
  }

  // 处理鼠标松开事件
  const handleMouseUp = () => {
    setDragging(false)
  }

  useEffect(() => {
    if (dragging) {
      window.addEventListener("mousemove", handleMouseMove)
      window.addEventListener("mouseup", handleMouseUp)
    }

    return () => {
      window.removeEventListener("mousemove", handleMouseMove)
      window.removeEventListener("mouseup", handleMouseUp)
    }
  }, [dragging])

  const formatErrorMessage = (msg: string) => {
    const codeLines = msg?.split("\n")

    return (
      <div className="space-y-2">
        <div className="rounded bg-[#1a1a1a] p-2 font-mono border border-[#00ff00]/20 whitespace-pre-wrap break-words max-w-[100%] mt-2">
          <ScrollArea className="h-16">
            {codeLines?.map(line => (
              <div key={line} className="flex items-center gap-2">
                <div className="flex-1 text-[#00ff00] animate-pulse-slow overflow-hidden break-all whitespace-pre-wrap w-full max-w-full">
                  {line}
                </div>
              </div>
            ))}
          </ScrollArea>
        </div>
      </div>
    )
  }

  return (
    <div
      className={cn(
        "absolute bottom-4 right-4 z-10 w-[18rem] rounded-lg border border-[#00ff00]/30 bg-black/90 p-4 text-[#00ff00] shadow-lg shadow-[#00ff00]/20 backdrop-blur-sm animate-slide-up",
        className,
      )}
      style={{
        transform: `translate(${position.x}px, ${position.y}px)`,
        userSelect: dragging ? "none" : "auto",
      }}
      onMouseDown={handleMouseDown}
    >
      <div className="grid gap-1">
        {/* 添加拖拽手柄样式 */}
        <div className="font-mono font-bold flex items-center gap-2 hover:cursor-move">
          <span className="inline-block w-2 h-2 rounded-full bg-[#00ff00] animate-pulse" />
          Try Compoder Auto Fix
          {/* <span className="ml-auto text-xs text-[#00ff00]/50">⎇ Drag</span> */}
        </div>
        <div className="text-xs leading-relaxed font-mono">
          {formatErrorMessage(message)}
        </div>
      </div>
      <button
        onClick={onFix}
        className="mt-2 inline-flex h-8 items-center justify-center rounded-md border
                 border-[#00ff00]/30 bg-transparent px-3 text-xs font-mono font-medium
                 text-[#00ff00] transition-all hover:bg-[#00ff00]/10
                 hover:shadow-[0_0_10px_rgba(0,255,0,0.3)] focus:outline-none
                 focus:ring-2 focus:ring-[#00ff00]/20 group"
      >
        <span className="mr-2 text-[#00ff00]/70">&gt;</span>
        EXECUTE AUTO FIX
      </button>
    </div>
  )
}
