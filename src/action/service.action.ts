'use server';
import prisma  from '@/lib/prisma';

import { requireRole, requireUser } from "@/lib/session";
// Type definitions
export interface ServiceInput {
    name: string;
    description?: string;
    price: number;
    duration: number; // Duration in months
}

export interface ServiceResponse {
    id: string;
    name: string;
    description?: string | null;
    price: number;
    duration: number;
    createdAt: Date;
    updatedAt: Date;
}

// 1. AddService
export async function AddService(data: ServiceInput): Promise<ServiceResponse> {
  await requireRole("ADMIN");
    try {
        // Validate inputs
        if (!data.name || !data.price || !data.duration) {
            throw new Error('Missing required fields');
        }

        if (data.price < 0) {
            throw new Error('Price cannot be negative');
        }

        if (data.duration <= 0) {
            throw new Error('Duration must be a positive number');
        }

        const service = await prisma.services.create({
            data: {
                name: data.name,
                description: data.description,
                price: Number(data.price),
                duration: Number(data.duration),
            },
        });

        return {
            ...service,
            description: service.description ?? undefined,
        };
    } catch (error:any) {
        throw new Error(`Failed to add service: ${error.message}`);
    }
}

// 2. GetAllServices
export async function GetAllServices(): Promise<ServiceResponse[]> {
  await requireUser();
    try {
        const services = await prisma.services.findMany({
            orderBy: { createdAt: 'desc' },
        });

        return services.map((service) => ({
            ...service,
            description: service.description ?? undefined,
        }));
    } catch (error:any) {
        throw new Error(`Failed to fetch services: ${error.message}`);
    }
}

// 3. GetServiceById
export async function GetServiceById(id: string): Promise<ServiceResponse | null> {
  await requireUser();
    try {
        const service = await prisma.services.findUnique({
            where: { id },
        });

        if (!service) {
            return null;
        }

        return {
            ...service,
            description: service.description ?? undefined,
        };
    } catch (error:any) {
        throw new Error(`Failed to fetch service: ${error.message}`);
    }
}

// 4. UpdateServiceById
export async function UpdateServiceById(id: string, data: Partial<ServiceInput>): Promise<ServiceResponse> {
  await requireRole("ADMIN");
    try {
        // Validate inputs
        if (data.price && data.price < 0) {
            throw new Error('Price cannot be negative');
        }

        if (data.duration && data.duration <= 0) {
            throw new Error('Duration must be a positive number');
        }

        const service = await prisma.services.update({
            where: { id },
            data: {
                name: data.name,
                description: data.description,
                price: data.price,
                duration: data.duration,
            },
        });

        return {
            ...service,
            description: service.description ?? undefined,
        };
    } catch (error:any) {
        throw new Error(`Failed to update service: ${ error.message }`);
    }
}

// 5. DeleteServiceById
export async function DeleteServiceById(id: string): Promise<void> {
  await requireRole("ADMIN");
    try {
        await prisma.services.delete({
            where: { id },
        });
    } catch (error:any) {
        throw new Error(`Failed to delete service: ${ error.message }`);
    }
}