import { createFileRoute } from "@tanstack/react-router";
import { Plus } from "lucide-react";
import { useState } from "react";
import { Shell } from "@/components/shell";
import {
  CATEGORIES,
  ShortcutsListingView,
} from "@/components/shortcuts-listing-view";
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
import { useShortcuts, type ShortcutCategory } from "@/hooks/use-shortcuts";

export const Route = createFileRoute("/_sidebar/shortcuts")({
  component: RouteComponent,
});

function RouteComponent() {
  const { shortcuts, loading, error, create, update, remove } = useShortcuts();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [newTrigger, setNewTrigger] = useState("");
  const [newReplacement, setNewReplacement] = useState("");
  const [newCategory, setNewCategory] = useState("all");

  const handleAddShortcut = async () => {
    if (!newTrigger.trim() || !newReplacement.trim()) return;
    await create(newTrigger.trim(), newReplacement.trim(), newCategory as ShortcutCategory);
    setNewTrigger("");
    setNewReplacement("");
    setNewCategory("all");
    setDialogOpen(false);
  };

  const resetDialog = () => {
    setDialogOpen(false);
    setNewTrigger("");
    setNewReplacement("");
    setNewCategory("all");
  };

  return (
    <Shell
      title="Shortcuts"
      subtitle="Create text shortcuts that expand into longer phrases."
      headerActions={
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm">
              <Plus className="size-4" />
              Add shortcut
            </Button>
          </DialogTrigger>
          <DialogContent className="bg-white">
            <DialogHeader>
              <DialogTitle>Add new snippet</DialogTitle>
              {/* <DialogDescription>
								Create a shortcut that expands into longer text when you type
								it.
							</DialogDescription> */}
            </DialogHeader>
            <div className="flex flex-col gap-4 py-4">
              <div className="flex flex-col gap-2">
                <Label htmlFor="trigger">Trigger</Label>
                <Input
                  id="trigger"
                  value={newTrigger}
                  onChange={(e) => setNewTrigger(e.target.value)}
                  placeholder="e.g., brb, omw, addr"
                  autoFocus
                />
                <p className="text-muted-foreground text-xs">
                  The short text you'll type to activate this snippet.
                </p>
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="replacement">Replacement</Label>
                <Input
                  id="replacement"
                  value={newReplacement}
                  onChange={(e) => setNewReplacement(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      handleAddShortcut();
                    }
                  }}
                  placeholder="e.g., be right back"
                />
                <p className="text-muted-foreground text-xs">
                  The full text that will replace your trigger.
                </p>
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
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={resetDialog}>
                Cancel
              </Button>
              <Button
                onClick={handleAddShortcut}
                disabled={!newTrigger.trim() || !newReplacement.trim()}
              >
                Add snippet
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      }
    >
      <ShortcutsListingView
        shortcuts={shortcuts}
        loading={loading}
        error={error}
        update={update}
        remove={remove}
        onAddClick={() => setDialogOpen(true)}
      />
    </Shell>
  );
}
