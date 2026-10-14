"use client";

import {
  createPaginatedRowModel,
  createSortedRowModel,
  createColumnHelper,
  rowPaginationFeature,
  rowSortingFeature,
  sortFns,
  tableFeatures,
  useTable,
} from "@tanstack/react-table";
import { ArrowDownIcon, ArrowUpIcon, ChevronsUpDownIcon } from "lucide-react";

import { Badge } from "@aspirant/ui/components/badge";
import { Button } from "@aspirant/ui/components/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@aspirant/ui/components/table";

import type { Person } from "@/lib/people";

// Features and row models are declared once, statically, outside the component.
const features = tableFeatures({
  rowSortingFeature,
  rowPaginationFeature,
  sortedRowModel: createSortedRowModel(),
  paginatedRowModel: createPaginatedRowModel(),
  sortFns,
});

const columnHelper = createColumnHelper<typeof features, Person>();

const columns = columnHelper.columns([
  columnHelper.accessor("name", { header: "Name" }),
  columnHelper.accessor("role", { header: "Role" }),
  columnHelper.accessor("team", { header: "Team" }),
  columnHelper.accessor("salary", {
    header: "Salary (k)",
    cell: (info) => `$${info.getValue()}k`,
  }),
  columnHelper.accessor("status", {
    header: "Status",
    cell: (info) => (
      <Badge variant={info.getValue() === "active" ? "default" : "secondary"}>
        {info.getValue()}
      </Badge>
    ),
  }),
]);

export function PeopleTable({ data }: { data: readonly Person[] }) {
  const table = useTable({
    features,
    columns,
    data,
    initialState: { pagination: { pageIndex: 0, pageSize: 8 } },
  });

  const { pageIndex } = table.state.pagination;
  const pageCount = table.getPageCount();

  return (
    <div className="grid gap-3">
      <Table>
        <TableHeader>
          {table.getHeaderGroups().map((headerGroup) => (
            <TableRow key={headerGroup.id}>
              {headerGroup.headers.map((header) => {
                const sorted = header.column.getIsSorted();
                return (
                  <TableHead
                    key={header.id}
                    aria-sort={
                      sorted === "asc" ? "ascending" : sorted === "desc" ? "descending" : "none"
                    }
                  >
                    <button
                      type="button"
                      className="inline-flex items-center gap-1 rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      onClick={header.column.getToggleSortingHandler()}
                    >
                      <table.FlexRender header={header} />
                      {sorted === "asc" ? (
                        <ArrowUpIcon className="size-3.5" />
                      ) : sorted === "desc" ? (
                        <ArrowDownIcon className="size-3.5" />
                      ) : (
                        <ChevronsUpDownIcon className="size-3.5 opacity-50" />
                      )}
                    </button>
                  </TableHead>
                );
              })}
            </TableRow>
          ))}
        </TableHeader>
        <TableBody>
          {table.getRowModel().rows.length === 0 ? (
            <TableRow>
              <TableCell
                colSpan={columns.length}
                className="h-24 text-center text-muted-foreground"
              >
                No results.
              </TableCell>
            </TableRow>
          ) : (
            table.getRowModel().rows.map((row) => (
              <TableRow key={row.id}>
                {row.getAllCells().map((cell) => (
                  <TableCell key={cell.id}>
                    <table.FlexRender cell={cell} />
                  </TableCell>
                ))}
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <span>
          Page {pageCount === 0 ? 0 : pageIndex + 1} of {pageCount} · {data.length} rows
        </span>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => table.previousPage()}
            disabled={!table.getCanPreviousPage()}
          >
            Previous
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => table.nextPage()}
            disabled={!table.getCanNextPage()}
          >
            Next
          </Button>
        </div>
      </div>
    </div>
  );
}
