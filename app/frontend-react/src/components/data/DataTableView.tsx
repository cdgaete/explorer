import { useEffect, useState, useMemo } from 'react'
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  flexRender,
  type ColumnDef,
  type SortingState,
} from '@tanstack/react-table'
import { Button } from '@/components/ui/button'
import { api } from '@/api/client'
import { ArrowUpDown, ChevronLeft, ChevronRight } from 'lucide-react'

interface DataTableViewProps {
  networkId: string
  component: 'buses' | 'generators' | 'lines' | 'loads' | 'links'
  columns: string[]
}

export function DataTableView({ networkId, component, columns }: DataTableViewProps) {
  const [data, setData] = useState<Record<string, unknown>[]>([])
  const [loading, setLoading] = useState(true)
  const [sorting, setSorting] = useState<SortingState>([])
  const [globalFilter, setGlobalFilter] = useState('')

  useEffect(() => {
    const loadData = async () => {
      setLoading(true)
      try {
        const result = await api.get<Record<string, Record<string, unknown>[]>>(
          `/networks/${networkId}/${component}`
        )
        setData(result[component] || [])
      } catch (e) {
        console.error(`Failed to load ${component}:`, e)
        setData([])
      } finally {
        setLoading(false)
      }
    }

    loadData()
  }, [networkId, component])

  const tableColumns = useMemo<ColumnDef<Record<string, unknown>>[]>(
    () =>
      columns.map((col) => ({
        accessorKey: col,
        header: ({ column }) => (
          <Button
            variant="ghost"
            size="sm"
            className="-ml-3 h-8"
            onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
          >
            {col}
            <ArrowUpDown className="ml-2 h-4 w-4" />
          </Button>
        ),
        cell: ({ getValue }) => {
          const value = getValue()
          if (typeof value === 'number') {
            return value.toLocaleString(undefined, { maximumFractionDigits: 4 })
          }
          return String(value ?? '-')
        },
      })),
    [columns]
  )

  const table = useReactTable({
    data,
    columns: tableColumns,
    state: {
      sorting,
      globalFilter,
    },
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: {
      pagination: {
        pageSize: 50,
      },
    },
  })

  if (loading) {
    return (
      <div className="flex items-center justify-center h-32 text-muted-foreground">
        Loading {component}...
      </div>
    )
  }

  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-32 text-muted-foreground">
        <div className="text-center">
          <p>No {component} data</p>
          <p className="text-sm mt-1">This network has no {component} defined</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <input
          type="text"
          placeholder={`Search ${component}...`}
          value={globalFilter}
          onChange={(e) => setGlobalFilter(e.target.value)}
          className="px-3 py-2 bg-secondary border border-border rounded-md text-sm w-64"
        />
        <div className="text-sm text-muted-foreground">
          {table.getFilteredRowModel().rows.length} rows
        </div>
      </div>

      <div className="border border-border rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id} className="border-b border-border bg-muted">
                {headerGroup.headers.map((header) => (
                  <th key={header.id} className="text-left p-3 font-medium">
                    {header.isPlaceholder
                      ? null
                      : flexRender(
                          header.column.columnDef.header,
                          header.getContext()
                        )}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {table.getRowModel().rows.map((row) => (
              <tr
                key={row.id}
                className="border-b border-border hover:bg-muted/50"
              >
                {row.getVisibleCells().map((cell) => (
                  <td key={cell.id} className="p-3">
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between">
        <div className="text-sm text-muted-foreground">
          Page {table.getState().pagination.pageIndex + 1} of{' '}
          {table.getPageCount()}
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => table.previousPage()}
            disabled={!table.getCanPreviousPage()}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => table.nextPage()}
            disabled={!table.getCanNextPage()}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  )
}
