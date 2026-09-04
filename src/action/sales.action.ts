"use server";

import prisma from "@/lib/prisma";
import { requireRole } from "@/lib/session";
import {
  format,
  parse,
  isValid,
  isWithinInterval,
  addMonths,
  addDays,
  subDays,
  startOfMonth,
  endOfMonth,
} from "date-fns";
import { MemberResponse } from "./member.action";

// Type definitions
export interface SalesInput {
  member_id: string;
  service_id: string;
  description?: string;
  discount: number;
  amount: number;
  paid: number;
  startDate: string; // Format: dd-MM-yyyy
}

export interface SalesResponse {
  id: string;
  member_id: string;
  service_id: string;
  description?: string | null;
  discount: number;
  amount: number;
  paid: number;
  startDate: string;
  endDate: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface ExpandedSalesResponse {
  id: string;
  member_id: string;
  service_id: string;
  description?: string | null;
  discount: number;
  amount: number;
  paid: number;
  startDate: string;
  endDate: string;
  createdAt: Date;
  updatedAt: Date;
  member: {
    id: string;
    name: string;
    memberCode: string;
    email?: string | null;
    phone: bigint;
    address?: string | null;
  };
  service: {
    id: string;
    name: string;
    price: number;
    duration: number;
  };
}

// Helper function to validate date format
const validateDateFormat = (dateStr: string): boolean => {
  const parsed = parse(dateStr, "dd-MM-yyyy", new Date());
  return isValid(parsed);
};

// 1. AddSales
export async function AddSales(data: SalesInput): Promise<SalesResponse> {
  await requireRole("ADMIN");
  try {
    // Validate inputs
    if (
      !data.member_id ||
      !data.service_id ||
      !data.amount ||
      !data.paid ||
      !data.startDate
    ) {
      throw new Error("Missing required fields");
    }

    if (data.discount < 0 || data.amount < 0 || data.paid < 0) {
      throw new Error("Discount, amount, and paid cannot be negative");
    }

    if (!validateDateFormat(data.startDate)) {
      throw new Error("Invalid start date format. Use dd-MM-yyyy");
    }

    // Fetch service to get duration
    const service = await prisma.services.findUnique({
      where: { id: data.service_id },
    });
    if (!service) {
      throw new Error("Service not found");
    }

    // Check if member exists
    const member = await prisma.member.findUnique({
      where: { id: data.member_id },
    });
    if (!member) {
      throw new Error("Member not found");
    }

    // Calculate endDate based on service duration (in months)
    const startDate = parse(data.startDate, "dd-MM-yyyy", new Date());
    const endDate = addMonths(startDate, service.duration);
    const formattedEndDate = format(endDate, "dd-MM-yyyy");

    const sale = await prisma.sales.create({
      data: {
        member_id: data.member_id,
        service_id: data.service_id,
        description: data.description,
        discount: data.discount,
        amount: data.amount,
        paid: data.paid,
        startDate: data.startDate,
        endDate: formattedEndDate,
      },
    });

    return {
      ...sale,
      description: sale.description ?? undefined,
    };
  } catch (error: any) {
    throw new Error(`Failed to add sale: ${error.message}`);
  }
}

// 2. GetAllSales
export async function GetAllSales(): Promise<SalesResponse[]> {
  await requireRole("TRAINER");
  try {
    const sales = await prisma.sales.findMany({
      orderBy: { createdAt: "desc" },
    });

    return sales.map((sale) => ({
      ...sale,
      description: sale.description ?? undefined,
    }));
  } catch (error: any) {
    throw new Error(`Failed to fetch sales: ${error.message}`);
  }
}

// 3. GetAllSalesByMemberId
export async function GetAllSalesByMemberId(
  member_id: string
): Promise<SalesResponse[]> {
  await requireRole("TRAINER");
  try {
    const sales = await prisma.sales.findMany({
      where: { member_id },
      orderBy: { createdAt: "desc" },
    });

    return sales.map((sale) => ({
      ...sale,
      description: sale.description ?? undefined,
    }));
  } catch (error: any) {
    throw new Error(`Failed to fetch sales for member: ${error.message}`);
  }
}

// 4. GetSaleById
export async function GetSaleById(id: string): Promise<SalesResponse | null> {
  await requireRole("TRAINER");
  try {
    const sale = await prisma.sales.findUnique({
      where: { id },
    });

    if (!sale) {
      return null;
    }

    return {
      ...sale,
      description: sale.description ?? undefined,
    };
  } catch (error: any) {
    throw new Error(`Failed to fetch sale: ${error.message}`);
  }
}

// 5. GetSaleByDate
export async function GetSaleByDate(date: string): Promise<SalesResponse[]> {
  await requireRole("TRAINER");
  try {
    if (!validateDateFormat(date)) {
      throw new Error("Invalid date format. Use dd-MM-yyyy");
    }

    const sales = await prisma.sales.findMany({
      where: {
        startDate: date,
      },
      orderBy: { createdAt: "desc" },
    });

    return sales.map((sale) => ({
      ...sale,
      description: sale.description ?? undefined,
    }));
  } catch (error: any) {
    throw new Error(`Failed to fetch sales by date: ${error.message}`);
  }
}

// 6. GetSaleByDateRange
export async function GetSaleByDateRange(
  startDate: string,
  endDate: string
): Promise<SalesResponse[]> {
  await requireRole("TRAINER");
  try {
    if (!validateDateFormat(startDate) || !validateDateFormat(endDate)) {
      throw new Error("Invalid date format. Use dd-MM-yyyy");
    }

    const sales = await prisma.sales.findMany({
      where: {
        startDate: {
          gte: startDate,
          lte: endDate,
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return sales.map((sale) => ({
      ...sale,
      description: sale.description ?? undefined,
    }));
  } catch (error: any) {
    throw new Error(`Failed to fetch sales by date range: ${error.message}`);
  }
}

// 7. UpdateSaleById
export async function UpdateSaleById(
  id: string,
  data: Partial<SalesInput>
): Promise<SalesResponse> {
  await requireRole("ADMIN");
  try {
    // Validate inputs
    if (data.discount && data.discount < 0) {
      throw new Error("Discount cannot be negative");
    }

    if (data.amount && data.amount < 0) {
      throw new Error("Amount cannot be negative");
    }

    if (data.paid && data.paid < 0) {
      throw new Error("Paid cannot be negative");
    }

    if (data.startDate && !validateDateFormat(data.startDate)) {
      throw new Error("Invalid start date format. Use dd-MM-yyyy");
    }

    // If updating startDate, recalculate endDate
    let endDate: string | undefined;
    if (data.startDate) {
      const sale = await prisma.sales.findUnique({
        where: { id },
        include: { service: true },
      });
      if (!sale) {
        throw new Error("Sale not found");
      }
      const startDate = parse(data.startDate, "dd-MM-yyyy", new Date());
      const newEndDate = addMonths(startDate, sale.service.duration);
      endDate = format(newEndDate, "dd-MM-yyyy");
    }

    const sale = await prisma.sales.update({
      where: { id },
      data: {
        member_id: data.member_id,
        service_id: data.service_id,
        description: data.description,
        discount: data.discount,
        amount: data.amount,
        paid: data.paid,
        startDate: data.startDate,
        endDate: endDate, // Only update if startDate is provided
      },
    });

    return {
      ...sale,
      description: sale.description ?? undefined,
    };
  } catch (error: any) {
    throw new Error(`Failed to update sale: ${error.message}`);
  }
}

// 8. GetAllActiveSale
export async function GetAllActiveSale(): Promise<SalesResponse[]> {
  await requireRole("TRAINER");
  try {
    const today = format(new Date(), "dd-MM-yyyy");
    const todayDate = parse(today, "dd-MM-yyyy", new Date());

    const sales = await prisma.sales.findMany({
      where: {
        AND: [{ startDate: { lte: today } }, { endDate: { gte: today } }],
      },
      orderBy: { createdAt: "desc" },
    });

    return sales.map((sale) => ({
      ...sale,
      description: sale.description ?? undefined,
    }));
  } catch (error: any) {
    throw new Error(`Failed to fetch active sales: ${error.message}`);
  }
}

// 9. GetActiveSaleByMemberId
export async function GetActiveSaleByMemberId(
  member_id: string
): Promise<SalesResponse[]> {
  await requireRole("TRAINER");
  try {
    const today = format(new Date(), "dd-MM-yyyy");
    const todayDate = parse(today, "dd-MM-yyyy", new Date());

    const sales = await prisma.sales.findMany({
      where: {
        member_id,
        AND: [{ startDate: { lte: today } }, { endDate: { gte: today } }],
      },
      orderBy: { createdAt: "desc" },
    });

    return sales.map((sale) => ({
      ...sale,
      description: sale.description ?? undefined,
    }));
  } catch (error: any) {
    throw new Error(
      `Failed to fetch active sales for member: ${error.message}`
    );
  }
}

// 10. GetAllSalesWithExpand
export async function GetAllSalesWithExpand(): Promise<
  ExpandedSalesResponse[]
> {
  await requireRole("TRAINER");
  try {
    const sales = await prisma.sales.findMany({
      include: {
        member: {
          select: {
            id: true,
            name: true,
            memberCode: true,
            email: true,
            phone: true,
          },
        },
        service: {
          select: {
            id: true,
            name: true,
            price: true,
            duration: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return sales.map((sale) => ({
      ...sale,
      description: sale.description ?? null,
      member: {
        ...sale.member,
        email: sale.member.email ?? null,
      },
      member_name: sale.member.name,
      service_name: sale.service.name,
      service: {
        ...sale.service,
      },
      dueAmount: sale.amount - sale.paid - (sale.discount ?? 0),
    }));
  } catch (error: any) {
    throw new Error(
      `Failed to fetch sales with expanded data: ${error.message}`
    );
  }
}

// DeleteSaleById
export async function DeleteSaleById(id: string): Promise<void> {
  await requireRole("ADMIN");
  try {
    await prisma.sales.delete({
      where: { id },
    });
  } catch (error: any) {
    throw new Error(`Failed to delete sale: ${error.message}`);
  }
}

export async function GetSalesEndingInXdays(
  days: number
): Promise<SalesResponse[]> {
  await requireRole("TRAINER");
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0); // Normalize to start of day
    // console.log(days)
    if (days >= 0) {
      const xDaysLater = addDays(today, days);
      const xDaysLaterStr = format(xDaysLater, "dd-MM-yyyy");

      const sales = await prisma.sales.findMany({
        where: {
          endDate: xDaysLaterStr,
        },
        orderBy: { createdAt: "desc" },
        include: {
          service: {
            select: {
              id: true,
              name: true,
            },
          },
          member: {
            select: {
              id: true,
              name: true,
              phone: true,
            },
          },
        },
      });
      return sales.map((sale) => ({
        ...sale,
        description: sale.description ?? undefined,
        service_name: sale.service.name,
        member_name: sale.member.name,
        member_phone: sale.member.phone,
      }));
    } else if (days === -1) {
      // Get all sales and then filter in JavaScript
      const allSales = await prisma.sales.findMany({
        orderBy: { createdAt: "desc" },
        include: {
          service: {
            select: {
              id: true,
              name: true,
            },
          },
          member: {
            select: {
              id: true,
              name: true,
              phone: true,
            },
          },
        },
      });

      // Filter sales where endDate is before today
      const expiredSales = allSales.filter((sale) => {
        try {
          const endDate = parse(sale.endDate, "dd-MM-yyyy", new Date());
          return endDate < today;
        } catch {
          return false; // Skip if date parsing fails
        }
      });

      return expiredSales.map((sale) => ({
        ...sale,
        description: sale.description ?? undefined,
        service_name: sale.service.name,
        member_name: sale.member.name,
        member_phone: sale.member.phone,
      }));
    }

    return [];
  } catch (error: any) {
    throw new Error(
      `Failed to fetch sales ending in ${days} days: ${error.message}`
    );
  }
}

/**
 * NOT session-guarded, deliberately.
 *
 * /invoices/[sale_id] is a public share link so a member can open or print an
 * invoice without logging in — it is protected by the sale's unguessable UUID.
 * Adding requireRole here breaks that page. If invoices should become
 * members-only, gate the route first, then guard this.
 */
export async function GetSaleWithExpand(sale_id: string): Promise<any> {
  try {
    const sale = await prisma.sales.findUnique({
      where: { id: sale_id },
      include: {
        member: {
          select: {
            id: true,
            name: true,
            memberCode: true,
            email: true,
            phone: true,
            address: true,
          },
        },
        service: {
          select: {
            id: true,
            name: true,
            price: true,
            duration: true,
          },
        },
      },
    });

    return sale;
  } catch (error: any) {
    throw new Error(
      `Failed to fetch sales with expanded data: ${error.message}`
    );
  }
}

export async function getAllExpiringSalesInXDays(
  days: number
): Promise<SalesResponse[]> {
  await requireRole("TRAINER");
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0); // Normalize to start of day

    if (days >= 0) {
      const xDaysLater = addDays(today, days);

      // Fetch all sales (we'll filter in JavaScript due to string date storage)
      const allSales = await prisma.sales.findMany({
        orderBy: { createdAt: "desc" },
        include: {
          service: {
            select: {
              id: true,
              name: true,
            },
          },
          member: {
            select: {
              id: true,
              name: true,
              phone: true,
            },
          },
        },
      });

      // Filter sales where endDate is between today and xDaysLater (inclusive)
      const expiringSales = allSales.filter((sale) => {
        try {
          const endDate = parse(sale.endDate, "dd-MM-yyyy", new Date());
          return endDate >= today && endDate <= xDaysLater;
        } catch {
          return false; // Skip if date parsing fails
        }
      });

      return expiringSales.map((sale) => ({
        ...sale,
        description: sale.description ?? undefined,
        service_name: sale.service.name,
        member_name: sale.member.name,
        member_phone: sale.member.phone,
      }));
    }

    return [];
  } catch (error: any) {
    throw new Error(
      `Failed to fetch sales expiring in ${days} days: ${error.message}`
    );
  }
}

// GetAllActiveMembers
export async function getAllActiveMembers(): Promise<MemberResponse[]> {
  await requireRole("TRAINER");
  try {
    const today = new Date();
    const sales = await prisma.sales.findMany({
      include: {
        member: {
          select: {
            id: true,
            name: true,
            email: true,
            memberCode: true,
            phone: true,
            address: true,
            DOB: true,
            gender: true,
            DOJ: true,
            createdAt: true,
            updatedAt: true,
          },
        },
      },
    });

    // Filter active sales based on date range
    const activeMembers = sales
      .filter((sale) => {
        const startDate = parse(sale.startDate, "dd-MM-yyyy", new Date());
        const endDate = parse(sale.endDate, "dd-MM-yyyy", new Date());
        return isWithinInterval(today, { start: startDate, end: endDate });
      })
      .map((sale) => sale.member);

    // Remove duplicate members by id
    const uniqueMembers = Array.from(
      new Map(activeMembers.map((member) => [member.id, member])).values()
    );

    return uniqueMembers.map((member) => ({
      ...member,
      email: member.email ?? undefined,
      address: member.address ?? undefined,
    }));
  } catch (error: any) {
    throw new Error(`Failed to fetch active members: ${error.message}`);
  }
}

// GetSalesWithinLast7Days
export async function GetSalesWithinLast7Days(): Promise<SalesResponse[]> {
  await requireRole("TRAINER");
  try {
    const today = new Date();
    const sevenDaysAgo = subDays(today, 7);

    const sales = await prisma.sales.findMany({
      orderBy: { createdAt: "desc" },
    });

    const filteredSales = sales.filter((sale) => {
      const startDate = parse(sale.startDate, "dd-MM-yyyy", new Date());
      return isWithinInterval(startDate, { start: sevenDaysAgo, end: today });
    });

    return filteredSales.map((sale) => ({
      ...sale,
      description: sale.description ?? undefined,
    }));
  } catch (error: any) {
    throw new Error(
      `Failed to fetch sales within last 7 days: ${error.message}`
    );
  }
}

// GetSalesInCurrentMonth
export async function GetSalesInCurrentMonth(): Promise<SalesResponse[]> {
  await requireRole("TRAINER");
  try {
    const today = format(new Date(), "MM-yyyy");

    const sales = await prisma.sales.findMany({
      where: {
        startDate: {
          contains: `-${today}`, // Matches dates ending with -MM-yyyy
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return sales.map((sale) => ({
      ...sale,
      description: sale.description ?? undefined,
    }));
  } catch (error: any) {
    throw new Error(`Failed to fetch sales in current month: ${error.message}`);
  }
}

// GetSalesWithPendingAmount
export async function GetSalesWithPendingAmount(): Promise<any> {
  await requireRole("TRAINER");
  try {
    const sales = await prisma.sales.findMany({
      include: {
        member: {
          select: {
            id: true,
            name: true,
            phone: true,
          },
        },
        service: {
          select: {
            id: true,
            name: true,
            price: true,
            duration: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    const filteredSales = sales.filter(
      (sale) => sale.amount - sale.discount - sale.paid > 0
    );

    return {
      sales: filteredSales.map((sale) => ({
        // ...sale,
        id: sale.id,
        description: sale.description ?? undefined,
        member_name: sale.member.name,
        member_phone: sale.member.phone,
        service_name: sale.service.name,
        amount: sale.amount,
        discount: sale.discount,
        paid: sale.paid,
        due: sale.amount - sale.discount - sale.paid,
        // service: {
        //   ...sale.service,
        // },
      })),
      total: filteredSales.reduce(
        (acc, sale) => acc + sale.amount - sale.discount - sale.paid,
        0
      ),
    };
  } catch (error: any) {
    throw new Error(
      `Failed to fetch sales with pending amount: ${error.message}`
    );
  }
}
