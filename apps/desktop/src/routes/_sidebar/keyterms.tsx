import { createFileRoute } from "@tanstack/react-router";
import { Plus } from "lucide-react";
import { useState } from "react";
import {
  CATEGORIES,
  KeytermsListingView,
} from "@/components/keyterms-listing-view";
import { Shell } from "@/components/shell";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useKeyterms, type KeytermCategory } from "@/hooks/use-keyterms";

export const Route = createFileRoute("/_sidebar/keyterms")({
  component: RouteComponent,
});

function RouteComponent() {
  const { keyterms, loading, error, create, update, remove } = useKeyterms();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [newTerm, setNewTerm] = useState("");
  const [newCategory, setNewCategory] = useState("all");

  const handleAddTerm = async () => {
    if (!newTerm.trim()) return;
    await create(newTerm, newCategory as KeytermCategory);
    setNewTerm("");
    setNewCategory("all");
    setDialogOpen(false);
  };

  const resetDialog = () => {
    setDialogOpen(false);
    setNewTerm("");
    setNewCategory("all");
  };

  return (
    <Shell
      title="Dictionary"
      subtitle="Add technical terms, proper nouns, and acronyms. Works with Deepgram and Whisper only."
      headerActions={
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm">
              <Plus className="size-4" />
              Add keyterm
            </Button>
          </DialogTrigger>
          <DialogContent className="bg-white">
            <DialogHeader>
              <DialogTitle>Add new keyterm</DialogTitle>
            </DialogHeader>
            <div className="flex flex-col gap-4 py-4">
              <div className="flex flex-col gap-2">
                <Label htmlFor="keyterm">Keyterm</Label>
                <Input
                  id="keyterm"
                  value={newTerm}
                  onChange={(e) => setNewTerm(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      handleAddTerm();
                    }
                  }}
                  placeholder="e.g., PostgreSQL, OAuth, KPI"
                  autoFocus
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="category">Apply to</Label>
                <Select value={newCategory} onValueChange={setNewCategory}>
                  <SelectTrigger className="h-14! w-full">
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent position="item-aligned">
                    {CATEGORIES.map((category) => (
                      <SelectItem key={category.value} value={category.value}>
                        <div className="flex flex-col items-start">
                          <span>{category.label}</span>
                          <span className="text-muted-foreground text-xs">
                            {category.description}
                          </span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-muted-foreground text-xs">
                  Choose which category this keyterm should be enforced in.
                </p>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={resetDialog}>
                Cancel
              </Button>
              <Button onClick={handleAddTerm} disabled={!newTerm.trim()}>
                Add keyterm
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      }
    >
      <KeytermsListingView
        keyterms={keyterms}
        loading={loading}
        error={error}
        update={update}
        remove={remove}
        onAddClick={() => setDialogOpen(true)}
      />
    </Shell>
  );
}
