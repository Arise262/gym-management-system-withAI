import Link from "next/link";
import { IconArrowLeft } from "@tabler/icons-react";
import { Button } from "@/components/ui/button";
import { FitnessProfileForm } from "@/components/fitness-profile-form";
import { GetMyFitnessProfile, GetEquipmentOptions } from "@/action/workout-plan.action";

export default async function Page() {
  const [profile, equipmentOptions] = await Promise.all([
    GetMyFitnessProfile(),
    GetEquipmentOptions(),
  ]);

  return (
    <div className="p-4 max-w-2xl mx-auto flex flex-col gap-4">
      <Link href="/member">
        <Button variant="ghost" size="sm" className="w-fit -ml-2">
          <IconArrowLeft className="mr-1 size-4" />
          Back
        </Button>
      </Link>
      <FitnessProfileForm profile={profile} equipmentOptions={equipmentOptions} />
    </div>
  );
}
