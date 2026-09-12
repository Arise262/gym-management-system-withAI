import { TrainerForm } from "../_components/TrainerForm";

export const metadata = { title: "Add a trainer" };

export default function NewTrainerPage() {
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 p-4">
      <div>
        <h1 className="font-display text-3xl font-semibold">Add a trainer</h1>
        <p className="text-muted-foreground text-sm">
          Creates their login and the profile members book. A temporary password is emailed to them — you never need to choose one.
        </p>
      </div>
      <TrainerForm />
    </div>
  );
}
