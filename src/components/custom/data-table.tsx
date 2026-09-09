'use client'
import {
    Table,
    TableBody,
    TableCaption,
    TableCell,
    TableFooter,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"
import { Input } from "../ui/input"
import { IconSearch } from "@tabler/icons-react"
import { useState, useMemo, ReactNode } from "react"
import { LoaderCircleIcon } from "lucide-react"

interface Props {
    dataRows: any[],
    columns: {
        accessorKey: string,
        header: string,
        headerClassName?: string,
        cellClassName?: string
    }[],
    actionColumns?: {
        accessorKey: string,
        header: string,
        headerClassName?: string,
        cellClassName?: string,
        cellContent?: React.ReactNode,
        cellContentGetRow?: (row: any) => React.ReactNode,
        onClick?: (rowId: any) => void,
        onClickGetRow?: (row: any) => void
    }[],
    isLoading?: boolean,
    onItemClick?: (row: any) => void
}

export function DataTable({
    dataRows,
    columns,
    actionColumns,
    isLoading,
    onItemClick,
    ...props
}: Props) {
    const [searchTerm, setSearchTerm] = useState("")

    // Leading "#" column + data columns + action columns. Used by the loading
    // and empty rows so they span the whole table.
    const totalColumns = 1 + columns.length + (actionColumns?.length ?? 0)

    const filteredRows = useMemo(() => {
        if (!searchTerm) return dataRows

        return dataRows.filter(row => {
            return columns.some(column => {
                const value = row[column.accessorKey]
                // Convert to string if not already and handle null/undefined
                const stringValue = value !== null && value !== undefined
                    ? String(value)
                    : ''
                return stringValue.toLowerCase().includes(searchTerm.toLowerCase())
            })
        })
    }, [dataRows, columns, searchTerm])

    return (
        <div className="space-y-4">
            <div className="relative">
                <Input
                    className="peer ps-8 pe-12"
                    placeholder="Search across all columns..."
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                />
                <span className="text-muted-foreground pointer-events-none absolute inset-y-0 start-0 flex items-center justify-center ps-3 text-sm peer-disabled:opacity-50">
                    <IconSearch className="size-4" />
                </span>
            </div>
            <div className="overflow-hidden rounded-lg border">
                <Table className="max-h-[100px]">
                    <TableHeader className="bg-input/30 sticky top-0 z-10">
                        <TableRow >
                            <TableHead className="">No.</TableHead>
                            {
                                columns.map((column) => (
                                    <TableHead className={column.headerClassName} key={column.accessorKey}>
                                        {column.header}
                                    </TableHead>
                                ))
                            }
                            {
                                actionColumns && (
                                    actionColumns.map((column, index) => (
                                        <TableHead className={column.headerClassName} key={index}>
                                            {column.header}
                                        </TableHead>
                                    ))
                                )
                            }
                        </TableRow>
                    </TableHeader>
                    {
                        isLoading ? (
                            // This used to put a <div> directly inside <tbody>, which is
                            // invalid HTML — React logged "In HTML, <div> cannot be a child
                            // of <tbody>" and the whole dashboard tree was regenerated on
                            // the client with a hydration mismatch. A row/cell is the only
                            // legal way to span a table. (The old `col-span-[n]` was a grid
                            // class on a table AND a dynamic string Tailwind never emits.)
                            <TableBody>
                                <TableRow>
                                    <TableCell colSpan={totalColumns} className="h-24">
                                        <div className="text-muted-foreground flex items-center justify-center gap-2">
                                            <LoaderCircleIcon
                                                className="-ms-1 animate-spin"
                                                size={16}
                                                aria-hidden="true"
                                            />
                                            Loading
                                        </div>
                                    </TableCell>
                                </TableRow>
                            </TableBody>
                        ) : (
                            <TableBody className="">
                                {filteredRows.length > 0 ? (
                                    filteredRows.map((row: any, index: number) => (
                                        <TableRow key={index}  className="cursor-pointer hover:bg-muted">
                                            <TableCell className="font-medium">{index + 1}</TableCell>
                                            {
                                                columns.map((column) => (
                                                    <TableCell
                                                        key={column.accessorKey}
                                                        className={column.cellClassName}
                                                        onClick={() => onItemClick && onItemClick(row)}
                                                    >
                                                        {row[column.accessorKey]}
                                                    </TableCell>
                                                ))
                                            }
                                            {
                                                actionColumns && (
                                                    actionColumns.map((column, index) => (
                                                        <TableCell className={column.cellClassName} key={index}>
                                                            <div onClick={() => {
                                                                column.onClick && column.onClick(row[column.accessorKey])
                                                                column.onClickGetRow && column.onClickGetRow(row)
                                                            }}>
                                                                {(column.cellContentGetRow) ? column.cellContentGetRow(row) : column.cellContent}
                                                            </div>
                                                        </TableCell>
                                                    )
                                                    ))
                                            }
                                        </TableRow>
                                    ))
                                ) : (
                                    <TableRow>
                                        <TableCell
                                            colSpan={totalColumns}
                                            className="h-24 text-center"
                                        >
                                            No results found
                                        </TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        )
                    }

                    {/* <TableFooter>
                    </TableFooter> */}
                </Table>
            </div>
        </div>
    )
}