"use client";

import Image from "next/image";
import * as React from "react";
import {
  IconBell,
  IconCake,
  IconChartBar,
  IconCreditCard,
  IconDashboard,
  IconDatabase,
  IconDoorEnter,
  IconFileAi,
  IconFileDescription,
  IconListDetails,
  IconQuestionMark,
  IconReport,
  IconSearch,
  IconToiletPaper,
  IconUser,
  IconUserCancel,
  IconUsers,
} from "@tabler/icons-react";

import { NavDocuments } from "@/components/nav-documents";
import { NavMain } from "@/components/nav-main";
import { NavUser } from "@/components/nav-user";
import { NavSecondary } from "@/components/nav-secondary";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { ModeToggle } from "./custom/theme-toggle";

const data = {
  navMain: [
    {
      title: "Dashboard",
      url: "/dashboard",
      icon: IconDashboard,
    },
    {
      title: "Members",
      url: "/members",
      icon: IconUsers,
    },
    {
      title: "Sales",
      url: "/sales",
      icon: IconChartBar,
    },
    {
      title: "Retention",
      url: "/retention",
      icon: IconUserCancel,
    },
    {
      title: "Payments",
      url: "/payments",
      icon: IconCreditCard,
    },
    {
      title: "Notifications",
      url: "/notifications",
      icon: IconBell,
    },
    {
      title: "Enquiries",
      url: "/enquiries",
      icon: IconSearch,
    },
    {
      title: "To Do",
      url: "/todo",
      icon: IconListDetails,
    },
    {
      title: "Service",
      url: "/services",
      icon: IconReport,
    },
  ],
  navSecondary: [
    {
      title: "Attendance",
      url: "/attendance",
      icon: IconDoorEnter,
    },
    {
      title: "Fitness Tools",
      url: "/tools",
      icon: IconToiletPaper,
    },
  ],
  documents: [
    {
      name: "New Member",
      url: "/members/new",
      icon: IconUser,
    },
    {
      name: "New Service",
      url: "/services/new",
      icon: IconDatabase,
    },
    {
      name: "New Enquiry",
      url: "/enquiries/new",
      icon: IconFileDescription,
    },
    {
      name: "New Sale",
      url: "/sales/new",
      icon: IconFileAi,
    },
  ],
  followups: [
    {
      name: "Enquiries",
      url: "/enquiries/followups",
      icon: IconQuestionMark,
    },
    {
      name: "Membership",
      url: "/sales/followups",
      icon: IconUserCancel,
    },
    {
      name: "Birthdays",
      url: "/members/birthdays",
      icon: IconCake,
    },
  ],
};

type SidebarUser = { name: string | null; email: string; role: string }

export function AppSidebar({
  user,
  ...props
}: React.ComponentProps<typeof Sidebar> & { user: SidebarUser }) {
  return (
    <Sidebar collapsible="offcanvas" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem className="flex justify-between items-center">
            <SidebarMenuButton
              asChild
              className="data-[slot=sidebar-menu-button]:!p-1.5"
            >
              <a href="#">
                <Image src="/logo.png" width={24} height={24} alt="" className="dark:hidden" />
                <Image src="/logo-light.png" width={24} height={24} alt="" className="hidden dark:block" />
                <span className="text-base font-semibold">CBG Fitness Center</span>
              </a>
            </SidebarMenuButton>
            <ModeToggle />
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <NavMain items={data.navMain} />
        <NavDocuments items={data.documents} title="Quick Creates" />
        <NavDocuments items={data.followups} title="Follow Ups" />
        <NavSecondary items={data.navSecondary} className="mt-auto" />
      </SidebarContent>
      <SidebarFooter>
        <NavUser user={user} />
      </SidebarFooter>
    </Sidebar>
  );
}
