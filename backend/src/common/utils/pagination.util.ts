import { IsOptional, IsInt, Min, Max, IsString } from 'class-validator';
import { Type } from 'class-transformer';

/** Cursor-based pagination DTO — use as query params */
export class CursorPaginationDto {
  @IsOptional()
  @IsString()
  cursor?: string; // ID of the last item on the previous page

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  @Type(() => Number)
  limit: number = 20;
}

export interface PaginatedResult<T> {
  items: T[];
  nextCursor: string | null;
  hasMore: boolean;
  total?: number;
}

/** Builds a cursor-paginated Prisma query and shapes the result */
export function buildCursorPaginatedResult<T extends { id: string }>(
  items: T[],
  limit: number,
): PaginatedResult<T> {
  const hasMore = items.length > limit;
  const data = hasMore ? items.slice(0, limit) : items;
  const nextCursor = hasMore ? data[data.length - 1].id : null;

  return { items: data, nextCursor, hasMore };
}
