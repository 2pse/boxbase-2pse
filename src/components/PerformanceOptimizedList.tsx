import React, { memo, useMemo } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ChevronLeft, ChevronRight } from "lucide-react";

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  hasMore?: boolean;
  loading?: boolean;
}

export const Pagination: React.FC<PaginationProps> = memo(({ 
  currentPage, 
  totalPages, 
  onPageChange, 
  hasMore,
  loading 
}) => {
  const canGoNext = useMemo(() => hasMore || currentPage < totalPages, [hasMore, currentPage, totalPages]);
  const canGoPrev = useMemo(() => currentPage > 1, [currentPage]);

  return (
    <div className="flex items-center justify-center gap-2 mt-4">
      <Button
        variant="outline"
        size="sm"
        onClick={() => onPageChange(currentPage - 1)}
        disabled={!canGoPrev || loading}
        className="h-8 w-8 p-0"
      >
        <ChevronLeft className="h-4 w-4" />
      </Button>
      
      <span className="text-sm text-muted-foreground min-w-[80px] text-center">
        Seite {currentPage} {totalPages > 0 && `von ${totalPages}`}
      </span>
      
      <Button
        variant="outline"
        size="sm"
        onClick={() => onPageChange(currentPage + 1)}
        disabled={!canGoNext || loading}
        className="h-8 w-8 p-0"
      >
        <ChevronRight className="h-4 w-4" />
      </Button>
    </div>
  );
});

Pagination.displayName = 'Pagination';

interface ListItemProps<T> {
  item: T;
  renderItem: (item: T, index: number) => React.ReactNode;
  index: number;
}

const ListItem = memo(<T,>({ item, renderItem, index }: ListItemProps<T>) => {
  return <>{renderItem(item, index)}</>;
});

(ListItem as any).displayName = 'ListItem';

interface PerformanceOptimizedListProps<T> {
  items: T[];
  renderItem: (item: T, index: number) => React.ReactNode;
  keyExtractor: (item: T, index: number) => string;
  loading?: boolean;
  emptyMessage?: string;
  className?: string;
  showPagination?: boolean;
  pagination?: PaginationProps;
}

export const PerformanceOptimizedList = <T,>({
  items,
  renderItem,
  keyExtractor,
  loading = false,
  emptyMessage = "Keine Daten gefunden",
  className = "",
  showPagination = false,
  pagination
}: PerformanceOptimizedListProps<T>) => {
  const memoizedItems = useMemo(() => items, [items]);

  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (memoizedItems.length === 0) {
    return (
      <Card className={className}>
        <CardContent className="py-8">
          <div className="text-center text-muted-foreground">
            {emptyMessage}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className={className}>
      <div className="space-y-2">
        {memoizedItems.map((item, index) => (
          <ListItem
            key={keyExtractor(item, index)}
            item={item}
            renderItem={renderItem}
            index={index}
          />
        ))}
      </div>
      
      {showPagination && pagination && (
        <Pagination {...pagination} />
      )}
    </div>
  );
};