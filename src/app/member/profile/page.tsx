import Link from "next/link";
import { IconArrowLeft } from "@tabler/icons-react";
import { Button } from "@/components/ui/button";
import { FitnessProfileForm } from "@/components/fitness-profile-form";
import { PersonalDetailsForm } from "@/components/personal-details-form";
import { GetMyFitnessProfile, GetEquipmentOptions } from "@/action/workout-plan.action";
import { GetMyDetails } from "@/action/profile.action";

export const metadata = { title: "Your profile" };

export default async function Page() {
  const [profile, equipmentOptions, details] = await Promise.all([
    GetMyFitnessProfile(),
    GetEquipmentOptions(),
    GetMyDetails(),
  ]);

  return (
    <div className="p-4 max-w-2xl mx-auto flex flex-col gap-4">
      <Link href="/member">
        <Button variant="ghost" size="sm" className="w-fit -ml-2">
          <IconArrowLeft className="mr-1 size-4" />
          Back
        </Button>
      </Link>

      {/* Personal details first: this is what a member comes here to fix after
          a typo at sign-up. The training questionnaire below is a longer,
          less urgent task. */}
      <PersonalDetailsForm details={details} />

      <FitnessProfileForm profile={profile} equipmentOptions={equipmentOptions} />
    </div>
  );
}
