"use server";

import prisma from "@/lib/prisma";
import { requireRole } from "@/lib/session";
import { loginEmailFor, hashPassword, DEFAULT_TEMP_PASSWORD } from "@/lib/accounts";
import {
  format,
  parse,
  isValid,
  isToday,
  startOfDay,
  endOfDay,
  isWithinInterval,
  differenceInYears,
} from "date-fns";
import { SalesResponse } from "./sales.action";
import { constants } from "buffer";
// import { Gender } from '@prisma/client';
type Gender = "male" | "female" | "other";
// Type definitions
export interface MemberInput {
  name: string;
  email?: string;
  memberCode: string;
  phone: number;
  address?: string;
  DOB: string; // Format: dd-MM-yyyy
  gender: Gender;
  DOJ: string; // Format: dd-MM-yyyy
}

export interface MemberResponse {
  id: string;
  name: string;
  email?: string | null;
  memberCode: string;
  phone: bigint;
  address?: string | null;
  DOB: string;
  gender: Gender;
  DOJ: string;
  createdAt: Date;
  updatedAt: Date;
}

// Helper function to validate date format
const validateDateFormat = (dateStr: string): boolean => {
  const parsed = parse(dateStr, "dd-MM-yyyy", new Date());
  return isValid(parsed);
};

// Helper function to validate phone number
const validatePhone = (phone: number): boolean => {
  return phone.toString().length === 10;
};

// 1. AddMember
export async function generateUniqueMemberCode(): Promise<string> {
  let memberCode: string;
  let isUnique = false;
  let attempts = 0;
  const maxAttempts = 10;

  while (!isUnique && attempts < maxAttempts) {
    // Generate a random number between 1 and 999999
    const randomNum = Math.floor(Math.random() * 999999) + 1;
    // Format the number with leading zeros to make it 7 digits
    memberCode = `MEM${randomNum.toString().padStart(7, "0")}`;

    // Check if the code already exists
    const existingMember = await prisma.member.findUnique({
      where: { memberCode },
    });

    if (!existingMember) {
      isUnique = true;
    }

    attempts++;
  }

  if (!isUnique) {
    throw new Error(
      "Failed to generate a unique member code after several attempts"
    );
  }

  return memberCode!;
}

export async function AddMember(data: MemberInput): Promise<MemberResponse> {
  await requireRole("ADMIN");
  try {
    // Validate inputs (remove memberCode from required fields)
    if (!data.name || !data.phone || !data.DOB || !data.DOJ || !data.gender) {
      throw new Error("Missing required fields");
    }

    if (!validatePhone(Number(data.phone))) {
      throw new Error("Phone number must be 10 digits");
    }

    if (!validateDateFormat(data.DOB) || !validateDateFormat(data.DOJ)) {
      throw new Error("Invalid date format. Use dd-MM-yyyy");
    }

    // Generate unique member code
    const memberCode = await generateUniqueMemberCode();
    const loginEmail = loginEmailFor(memberCode, data.email);

    const clash = await prisma.user.findUnique({ where: { email: loginEmail } });
    if (clash) {
      throw new Error(`An account already uses the email ${loginEmail}`);
    }

    const passwordHash = await hashPassword(DEFAULT_TEMP_PASSWORD);

    // A staff-created member needs a login too, or they can never sign in.
    // Both rows are written together so a member can never exist without an
    // account (or an account without its member).
    const member = await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: { email: loginEmail, passwordHash, role: "MEMBER" },
      });
      return tx.member.create({
        data: {
          userId: user.id,
          name: data.name,
          email: data.email,
          memberCode, // Use the generated code
          phone: Number(data.phone),
          address: data.address,
          DOB: data.DOB,
          gender: data.gender,
          DOJ: data.DOJ,
        },
      });
    });

    return {
      ...member,
      email: member.email ?? undefined,
      address: member.address ?? undefined,
    };
  } catch (error: any) {
    throw new Error(`Failed to add member: ${error.message}`);
  }
}

// 2. GetMemberById
export async function GetMemberById(
  id: string
): Promise<MemberResponse | null> {
  await requireRole("TRAINER");
  try {
    const member = await prisma.member.findUnique({
      where: { id },
    });

    if (!member) {
      return null;
    }

    return {
      ...member,
      email: member.email ?? undefined,
      address: member.address ?? undefined,
    };
  } catch (error: any) {
    throw new Error(`Failed to fetch member: ${error.message}`);
  }
}

// 3. GetMemberByMemberCode
export async function GetMemberByMemberCode(
  memberCode: string
): Promise<MemberResponse | null> {
  await requireRole("TRAINER");
  try {
    const member = await prisma.member.findUnique({
      where: { memberCode },
    });

    if (!member) {
      return null;
    }

    return {
      ...member,
      email: member.email ?? undefined,
      address: member.address ?? undefined,
    };
  } catch (error: any) {
    throw new Error(`Failed to fetch member: ${error.message}`);
  }
}

// 4. GetAllMembers
export async function GetAllMembers(): Promise<MemberResponse[]> {
  await requireRole("TRAINER");
  try {
    const members = await prisma.member.findMany({
      orderBy: { createdAt: "desc" },
    });
    return members.map((member: any) => ({
      ...member,
      email: member.email ?? undefined,
      address: member.address ?? undefined,
    }));
  } catch (error: any) {
    throw new Error(`Failed to fetch members: ${error.message}`);
  }
}

// 5. GetAllActiveMembers
// export async function GetAllActiveMembers(): Promise<MemberResponse[]> {
//   try {
//     const today = format(new Date(), "dd-MM-yyyy");
//     const members = await prisma.member.findMany({
//       where: {
//         sales: {
//           some: {
//             startDate: { lte: today },
//             endDate: { gte: today },
//           },
//         },
//       },
//       orderBy: { createdAt: "desc" },
//     });

//     return members.map((member: any) => ({
//       ...member,
//       email: member.email ?? undefined,
//       address: member.address ?? undefined,
//     }));
//   } catch (error: any) {
//     throw new Error(`Failed to fetch active members: ${error.message}`);
//   }
// }

// 6. UpdateMemberById
export async function UpdateMemberById(
  id: string,
  data: Partial<MemberInput>
): Promise<MemberResponse> {
  await requireRole("ADMIN");
  try {
    // Validate inputs
    if (data.phone && !validatePhone(data.phone)) {
      throw new Error("Phone number must be 10 digits");
    }

    if (data.DOB && !validateDateFormat(data.DOB)) {
      throw new Error("Invalid DOB format. Use dd-MM-yyyy");
    }

    if (data.DOJ && !validateDateFormat(data.DOJ)) {
      throw new Error("Invalid DOJ format. Use dd-MM-yyyy");
    }

    if (data.memberCode) {
      const existingMember = await prisma.member.findUnique({
        where: { memberCode: data.memberCode },
      });
      if (existingMember && existingMember.id !== id) {
        throw new Error("Member code already exists");
      }
    }

    const member = await prisma.member.update({
      where: { id },
      data: {
        name: data.name,
        email: data.email,
        memberCode: data.memberCode,
        phone: data.phone,
        address: data.address,
        DOB: data.DOB,
        gender: data.gender,
        DOJ: data.DOJ,
      },
    });

    return {
      ...member,
      email: member.email ?? undefined,
      address: member.address ?? undefined,
    };
  } catch (error: any) {
    throw new Error(`Failed to update member: ${error.message}`);
  }
}

// 7. DeleteMemberById
export async function DeleteMemberById(id: string): Promise<void> {
  await requireRole("ADMIN");
  try {
    const member = await prisma.member.findUnique({
      where: { id },
      select: { userId: true },
    });

    await prisma.$transaction(async (tx) => {
      await tx.member.delete({ where: { id } });
      // Otherwise the login survives the member and keeps its email reserved,
      // which then blocks re-registering the same person.
      if (member?.userId) {
        await tx.user.delete({ where: { id: member.userId } });
      }
    });
  } catch (error: any) {
    throw new Error(`Failed to delete member: ${error.message}`);
  }
}

// 8. GetMembersWithTodaysBirthday
export async function GetMembersWithTodaysBirthday(): Promise<
  MemberResponse[]
> {
  await requireRole("TRAINER");
  try {
    const today = format(new Date(), "dd-MM-yyyy");
    const todayDayMonth = today.slice(0, 5); // Get dd-MM

    const members = await prisma.member.findMany({
      where: {
        DOB: {
          contains: todayDayMonth, // Match dd-MM part of DOB
        },
      },
    });

    return members.map((member: any) => ({
      ...member,
      email: member.email ?? undefined,
      address: member.address ?? undefined,
    }));
  } catch (error: any) {
    throw new Error(
      `Failed to fetch members with today's birthday: ${error.message}`
    );
  }
}

export async function GetMembersWithDOB(
  date: string
): Promise<MemberResponse[]> {
  await requireRole("TRAINER");
  try {
    const SlicedDate = date.slice(0, 5);
    const members = await prisma.member.findMany({
      where: {
        DOB: {
          contains: SlicedDate,
        },
      },
    });
    return members.map((member: any) => ({
      ...member,
      email: member.email ?? undefined,
      address: member.address ?? undefined,
    }));
  } catch (error: any) {
    throw new Error(`Failed to fetch members with DOB: ${error.message}`);
  }
}

// GetAllMembersWithActiveSale
export async function getAllMembersWithActiveSale(): Promise<
  (MemberResponse & { activeSale: SalesResponse | null })[]
> {
  await requireRole("TRAINER");
  try {
    const today = new Date();
    const members = await prisma.member.findMany({
      include: {
        sales: {
          orderBy: { createdAt: "desc" },
          include: {
            service: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return members.map((member) => {
      // Find the most recent active sale
      const activeSale =
        member.sales
          .filter((sale) => {
            const startDate = parse(sale.startDate, "dd-MM-yyyy", new Date());
            const endDate = parse(sale.endDate, "dd-MM-yyyy", new Date());
            return isWithinInterval(today, { start: startDate, end: endDate });
          })
          .sort(
            (a, b) =>
              new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
          )[0] || null;

      return {
        ...member,
        email: member.email ?? undefined,
        address: member.address ?? undefined,
        activeSale: activeSale
          ? {
            ...activeSale,
            description: activeSale.description ?? undefined,
          }
          : null,
        activeServiceName: activeSale ? activeSale.service.name : null,
        age: differenceInYears(
          today,
          parse(member.DOB, "dd-MM-yyyy", new Date())
        ),
      };
    });
  } catch (error: any) {
    throw new Error(
      `Failed to fetch members with active sale: ${error.message}`
    );
  }
}

export async function getAllInActiveMembers(): Promise<any[]> {
  await requireRole("TRAINER");
  try {
    const today = new Date();

    const members = await prisma.member.findMany({
      include: {
        sales: {
          orderBy: { createdAt: "desc" },
          include: {
            service: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    // Efficiently filter and map in a single pass
    const activeMembers = members.reduce((result: any[], member) => {
      const activeSale = member.sales.find((sale) => {
        const startDate = parse(sale.startDate, "dd-MM-yyyy", new Date());
        const endDate = parse(sale.endDate, "dd-MM-yyyy", new Date());
        return isWithinInterval(today, { start: startDate, end: endDate });
      });

      if (!activeSale) {
        result.push({
          ...member,
          email: member.email ?? undefined,
          address: member.address ?? undefined,
          age: differenceInYears(
            today,
            parse(member.DOB, "dd-MM-yyyy", new Date())
          ),
        });
      }

      return result;
    }, []);

    return activeMembers;
  } catch (error: any) {
    throw new Error(
      `Failed to fetch members with active sale: ${error.message}`
    );
  }
}


export async function getAllActiveMembers(): Promise<any[]> {
  await requireRole("TRAINER");
  try {
    const today = new Date();

    const members = await prisma.member.findMany({
      include: {
        sales: {
          orderBy: { createdAt: "desc" },
          include: {
            service: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    // Efficiently filter and map in a single pass
    const activeMembers = members.reduce((result: any[], member) => {
      const activeSale = member.sales.find((sale) => {
        const startDate = parse(sale.startDate, "dd-MM-yyyy", new Date());
        const endDate = parse(sale.endDate, "dd-MM-yyyy", new Date());
        return isWithinInterval(today, { start: startDate, end: endDate });
      });

      if (activeSale) {
        result.push({
          ...member,
          email: member.email ?? undefined,
          address: member.address ?? undefined,
          activeSale,
          activeServiceName: activeSale.service?.name ?? null,
          age: differenceInYears(
            today,
            parse(member.DOB, "dd-MM-yyyy", new Date())
          ),
        });
      }

      return result;
    }, []);

    return activeMembers;
  } catch (error: any) {
    throw new Error(
      `Failed to fetch members with active sale: ${error.message}`
    );
  }
}



export async function updateReviewStatus(member_id: string, status: boolean) {
  await requireRole("ADMIN");
  console.log(member_id, status);
  try {
    const members = await prisma.member.update({
      where: {
        id: member_id,
      },
      data: {
        reviewDone: status,
      },
    })
    console.log(members);
    return {
      success: true
    }
  } catch (error: any) {
    return {
      success: false
    }
  }
}