"use client";

import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical } from "lucide-react";
import * as React from "react";
import { cn } from "@/lib/utils/cn";

/** Wraps columns; reports `(cardId, columnId)` when a card lands on a column. */
export function KanbanBoard({
  onMove,
  children,
  className,
}: {
  onMove: (cardId: string, toColumn: string) => void;
  children: React.ReactNode;
  className?: string;
}) {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }), useSensor(KeyboardSensor));
  function onDragEnd(e: DragEndEvent) {
    if (e.over && e.active.data.current?.column !== e.over.id) onMove(String(e.active.id), String(e.over.id));
  }
  return (
    <DndContext sensors={sensors} onDragEnd={onDragEnd}>
      <div className={cn("flex gap-3 overflow-x-auto pb-2", className)}>{children}</div>
    </DndContext>
  );
}

export function KanbanColumn({
  id,
  title,
  count,
  children,
  className,
}: {
  id: string;
  title: React.ReactNode;
  count?: number;
  children: React.ReactNode;
  className?: string;
}) {
  const { setNodeRef, isOver } = useDroppable({ id });
  return (
    <section
      ref={setNodeRef}
      aria-label={typeof title === "string" ? title : undefined}
      className={cn(
        "flex w-72 shrink-0 flex-col gap-2 rounded-lg border border-line bg-sand/70 p-2 transition-colors",
        isOver && "border-primary bg-primary-soft",
        className,
      )}
    >
      <header className="flex items-center justify-between px-2 py-1.5">
        <h3 className="text-sm font-semibold">{title}</h3>
        {count !== undefined && <span className="rounded-full bg-surface px-2 text-xs font-semibold text-muted tabular">{count}</span>}
      </header>
      <div className="flex min-h-24 flex-col gap-2">{children}</div>
    </section>
  );
}

export function KanbanCard({
  id,
  column,
  dragLabel,
  children,
}: {
  id: string;
  column: string;
  /** Accessible name of the drag handle, e.g. "Déplacer Pizzeria Roma". */
  dragLabel: string;
  children: React.ReactNode;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id, data: { column } });
  return (
    <article
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform) }}
      className={cn("flex items-start gap-1 rounded-md border border-line bg-surface p-2 shadow-card", isDragging && "z-10 opacity-80 shadow-sheet")}
    >
      <button
        type="button"
        className="inline-flex h-11 w-7 shrink-0 cursor-grab items-center justify-center text-muted active:cursor-grabbing"
        aria-label={dragLabel}
        {...listeners}
        {...attributes}
      >
        <GripVertical className="size-4" />
      </button>
      <div className="min-w-0 flex-1 py-1">{children}</div>
    </article>
  );
}
