import { useState, useMemo } from "react";
import { Plus, Calendar, Clock, Trash2, MapPin, Coffee, PartyPopper, ClipboardList } from "lucide-react";
import { format, eachDayOfInterval, parseISO } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  useEventScheduleBlocks,
  useAddScheduleBlock,
  useRemoveScheduleBlock,
  type ScheduleBlock,
} from "@/hooks/useEventSchedule";

const BLOCK_TYPE_CONFIG: Record<string, { icon: React.ReactNode; label: string; color: string }> = {
  activity: { icon: <PartyPopper className="h-3.5 w-3.5" />, label: "Activity", color: "bg-primary/10 text-primary" },
  break: { icon: <Coffee className="h-3.5 w-3.5" />, label: "Break", color: "bg-muted text-muted-foreground" },
  ceremony: { icon: <PartyPopper className="h-3.5 w-3.5" />, label: "Ceremony", color: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200" },
  registration: { icon: <ClipboardList className="h-3.5 w-3.5" />, label: "Registration", color: "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-200" },
  other: { icon: <Clock className="h-3.5 w-3.5" />, label: "Other", color: "bg-muted text-muted-foreground" },
};

interface EventScheduleTabProps {
  eventId: string;
  eventDate: string;
  endDate: string | null;
}

export function EventScheduleTab({ eventId, eventDate, endDate }: EventScheduleTabProps) {
  const { data: blocks = [], isLoading } = useEventScheduleBlocks(eventId);
  const addBlock = useAddScheduleBlock();
  const removeBlock = useRemoveScheduleBlock();
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [selectedDay, setSelectedDay] = useState<string>("");

  // Generate array of days
  const days = useMemo(() => {
    const start = parseISO(eventDate);
    const end = endDate ? parseISO(endDate) : start;
    return eachDayOfInterval({ start, end });
  }, [eventDate, endDate]);

  // Group blocks by day
  const blocksByDay = useMemo(() => {
    const grouped: Record<string, ScheduleBlock[]> = {};
    days.forEach(day => {
      const key = format(day, "yyyy-MM-dd");
      grouped[key] = blocks.filter(b => b.day_date === key);
    });
    return grouped;
  }, [blocks, days]);

  const [activeDay, setActiveDay] = useState(() => format(days[0], "yyyy-MM-dd"));

  // Form state
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [location, setLocation] = useState("");
  const [blockType, setBlockType] = useState("activity");

  const resetForm = () => {
    setTitle(""); setDescription(""); setStartTime(""); setEndTime("");
    setLocation(""); setBlockType("activity");
  };

  const handleAdd = async () => {
    if (!title.trim()) return;
    const dayDate = selectedDay || activeDay;
    await addBlock.mutateAsync({
      event_id: eventId,
      day_date: dayDate,
      start_time: startTime || null,
      end_time: endTime || null,
      title: title.trim(),
      description: description.trim() || null,
      location: location.trim() || null,
      block_type: blockType,
      display_order: (blocksByDay[dayDate] || []).length,
    });
    resetForm();
    setShowAddDialog(false);
  };

  const openAddForDay = (dayKey: string) => {
    setSelectedDay(dayKey);
    setShowAddDialog(true);
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                <Calendar className="h-4 w-4 text-primary" />
                Day-by-Day Schedule
              </CardTitle>
              <CardDescription>
                {days.length} day{days.length !== 1 ? "s" : ""} •{" "}
                {blocks.length} block{blocks.length !== 1 ? "s" : ""} scheduled
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {days.length > 1 ? (
            <Tabs value={activeDay} onValueChange={setActiveDay}>
              <TabsList className="w-full flex overflow-x-auto">
                {days.map(day => {
                  const key = format(day, "yyyy-MM-dd");
                  const count = (blocksByDay[key] || []).length;
                  return (
                    <TabsTrigger key={key} value={key} className="flex-1 min-w-[80px]">
                      <div className="text-center">
                        <div className="text-xs">{format(day, "EEE")}</div>
                        <div className="font-bold">{format(day, "MMM d")}</div>
                        {count > 0 && <Badge variant="secondary" className="text-[10px] mt-0.5">{count}</Badge>}
                      </div>
                    </TabsTrigger>
                  );
                })}
              </TabsList>

              {days.map(day => {
                const key = format(day, "yyyy-MM-dd");
                return (
                  <TabsContent key={key} value={key} className="mt-4">
                    <DaySchedule
                      dayKey={key}
                      blocks={blocksByDay[key] || []}
                      onAddBlock={() => openAddForDay(key)}
                      onRemoveBlock={(blockId) => removeBlock.mutate({ blockId, eventId })}
                    />
                  </TabsContent>
                );
              })}
            </Tabs>
          ) : (
            <DaySchedule
              dayKey={format(days[0], "yyyy-MM-dd")}
              blocks={blocksByDay[format(days[0], "yyyy-MM-dd")] || []}
              onAddBlock={() => openAddForDay(format(days[0], "yyyy-MM-dd"))}
              onRemoveBlock={(blockId) => removeBlock.mutate({ blockId, eventId })}
            />
          )}
        </CardContent>
      </Card>

      {/* Add Block Dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Add Schedule Block</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Title *</Label>
              <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. Opening Ceremony" />
            </div>
            <div className="space-y-2">
              <Label>Type</Label>
              <Select value={blockType} onValueChange={setBlockType}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="activity">Activity</SelectItem>
                  <SelectItem value="registration">Registration</SelectItem>
                  <SelectItem value="ceremony">Ceremony</SelectItem>
                  <SelectItem value="break">Break</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Start Time</Label>
                <Input type="time" value={startTime} onChange={e => setStartTime(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>End Time</Label>
                <Input type="time" value={endTime} onChange={e => setEndTime(e.target.value)} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Location</Label>
              <Input value={location} onChange={e => setLocation(e.target.value)} placeholder="Room / area" />
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea value={description} onChange={e => setDescription(e.target.value)} rows={2} placeholder="Details about this block" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddDialog(false)}>Cancel</Button>
            <Button onClick={handleAdd} disabled={!title.trim() || addBlock.isPending}>
              {addBlock.isPending ? "Adding..." : "Add Block"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function DaySchedule({
  dayKey,
  blocks,
  onAddBlock,
  onRemoveBlock,
}: {
  dayKey: string;
  blocks: ScheduleBlock[];
  onAddBlock: () => void;
  onRemoveBlock: (blockId: string) => void;
}) {
  if (blocks.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <Calendar className="h-8 w-8 mx-auto mb-2 opacity-50" />
        <p className="text-sm">No schedule blocks for this day</p>
        <Button size="sm" variant="outline" className="mt-3" onClick={onAddBlock}>
          <Plus className="h-4 w-4 mr-1" /> Add Block
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {blocks.map(block => {
        const config = BLOCK_TYPE_CONFIG[block.block_type] || BLOCK_TYPE_CONFIG.other;
        return (
          <div key={block.id} className="flex items-start gap-3 p-3 rounded-lg border bg-card group hover:bg-muted/30 transition-colors">
            {/* Time column */}
            <div className="w-16 shrink-0 text-xs text-muted-foreground pt-0.5">
              {block.start_time && (
                <div className="font-medium">{block.start_time.slice(0, 5)}</div>
              )}
              {block.end_time && (
                <div>{block.end_time.slice(0, 5)}</div>
              )}
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-medium text-sm">{block.title}</span>
                <Badge variant="outline" className={`text-[10px] ${config.color}`}>
                  {config.icon}
                  <span className="ml-1">{config.label}</span>
                </Badge>
              </div>
              {block.description && (
                <p className="text-xs text-muted-foreground mt-1">{block.description}</p>
              )}
              {block.location && (
                <div className="flex items-center gap-1 mt-1 text-xs text-muted-foreground">
                  <MapPin className="h-3 w-3" /> {block.location}
                </div>
              )}
            </div>

            <Button
              variant="ghost" size="icon"
              className="h-7 w-7 opacity-0 group-hover:opacity-100 text-destructive hover:text-destructive shrink-0"
              onClick={() => onRemoveBlock(block.id)}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        );
      })}

      <Button size="sm" variant="outline" className="w-full" onClick={onAddBlock}>
        <Plus className="h-4 w-4 mr-1" /> Add Block
      </Button>
    </div>
  );
}
