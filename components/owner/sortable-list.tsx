"use client";

import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { arrayMove, SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical } from "lucide-react";
import { useTranslations } from "next-intl";
import * as React from "react";
import { cn } from "@/lib/utils/cn";

type Props<T extends { id: string }> = {
  items: T[];
  onReorder: (ids: string[]) => void;
  /** Accessible name of each row's drag handle. */
  handleLabel: (item: T) => string;
  renderItem: (item: T, handle: React.ReactNode) => React.ReactNode;
  disabled?: boolean;
  className?: string;
};

/** Vertical drag-to-reorder list (mouse, touch, keyboard). Optimistic: calls onReorder with the new id order. */
export function SortableList<T extends { id: string }>({ items, onReorder, handleLabel, renderItem, disabled, className }: Props<T>) {
  const t = useTranslations("menuAdmin.dnd");
  const [order, setOrder] = React.useState(items);
  React.useEffect(() => setOrder(items), [items]);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  function onDragEnd(e: DragEndEvent) {
    if (!e.over || e.active.id === e.over.id) return;
    const from = order.findIndex((i) => i.id === e.active.id);
    const to = order.findIndex((i) => i.id === e.over!.id);
    const next = arrayMove(order, from, to);
    setOrder(next);
    onReorder(next.map((i) => i.id));
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={onDragEnd}
      accessibility={{
        screenReaderInstructions: { draggable: t("instructions") },
        announcements: {
          onDragStart: () => t("picked"),
          onDragOver: () => t("moved"),
          onDragEnd: () => t("dropped"),
          onDragCancel: () => t("cancelled"),
        },
      }}
    >
      <SortableContext items={order.map((i) => i.id)} strategy={verticalListSortingStrategy} disabled={disabled}>
        <ul className={cn("flex flex-col", className)}>
          {order.map((item) => (
            <SortableRow key={item.id} id={item.id} label={handleLabel(item)} disabled={disabled}>
              {(handle) => renderItem(item, handle)}
            </SortableRow>
          ))}
        </ul>
      </SortableContext>
    </DndContext>
  );
}

function SortableRow({ id, label, disabled, children }: { id: string; label: string; disabled?: boolean; children: (handle: React.ReactNode) => React.ReactNode }) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({ id, disabled });
  const handle = disabled ? null : (
    <button
      type="button"
      ref={setActivatorNodeRef}
      aria-label={label}
      className="inline-flex size-11 shrink-0 cursor-grab touch-none items-center justify-center text-muted active:cursor-grabbing"
      {...attributes}
      {...listeners}
    >
      <GripVertical className="size-5" />
    </button>
  );
  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={cn("relative", isDragging && "z-10 shadow-sheet")}
    >
      {children(handle)}
    </li>
  );
}
