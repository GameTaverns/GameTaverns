import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { format } from "date-fns";
import { CalendarIcon, Vote, PartyPopper } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { useCreatePoll } from "@/hooks/usePolls";
import { GameSelectorForPoll } from "./GameSelectorForPoll";

const pollSchema = z.object({
  title: z.string().min(1, "Title is required").max(100),
  description: z.string().max(500).optional(),
  pollType: z.enum(["quick", "game_night"]),
  eventDate: z.date().optional(),
  eventLocation: z.string().max(200).optional(),
  votingEndsAt: z.date().optional(),
  maxVotesPerUser: z.number().min(1).max(10).default(1),
  showResultsBeforeClose: z.boolean().default(false),
  gameIds: z.array(z.string()).min(2, "Select at least 2 games").max(10, "Maximum 10 games"),
});

type PollFormValues = z.infer<typeof pollSchema>;

interface CreatePollDialogProps {
  libraryId: string;
  trigger?: React.ReactNode;
}

export function CreatePollDialog({ libraryId, trigger }: CreatePollDialogProps) {
  const [open, setOpen] = useState(false);
  const createPoll = useCreatePoll();

  const form = useForm<PollFormValues>({
    resolver: zodResolver(pollSchema),
    defaultValues: {
      title: "",
      description: "",
      pollType: "quick",
      maxVotesPerUser: 1,
      showResultsBeforeClose: false,
      gameIds: [],
    },
  });

  const pollType = form.watch("pollType");

  const onSubmit = async (values: PollFormValues) => {
    await createPoll.mutateAsync({
      libraryId,
      title: values.title,
      description: values.description,
      pollType: values.pollType,
      eventDate: values.eventDate?.toISOString(),
      eventLocation: values.eventLocation,
      votingEndsAt: values.votingEndsAt?.toISOString(),
      maxVotesPerUser: values.maxVotesPerUser,
      showResultsBeforeClose: values.showResultsBeforeClose,
      gameIds: values.gameIds,
    });
    setOpen(false);
    form.reset();
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button>
            <Vote className="h-4 w-4 mr-2" />
            Create Poll
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-2xl max-h-[100dvh] sm:max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create Game Poll</DialogTitle>
          <DialogDescription>
            Let your group vote on which game to play
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            {/* Poll Type */}
            <Tabs
              value={pollType}
              onValueChange={(v) => form.setValue("pollType", v as "quick" | "game_night")}
            >
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="quick" className="flex items-center gap-2">
                  <Vote className="h-4 w-4" />
                  Quick Vote
                </TabsTrigger>
                <TabsTrigger value="game_night" className="flex items-center gap-2">
                  <PartyPopper className="h-4 w-4" />
                  Game Night
                </TabsTrigger>
              </TabsList>

              <TabsContent value="quick" className="mt-4">
                <p className="text-sm text-muted-foreground">
                  Create a simple poll to quickly decide what to play. Share the link and see votes in real-time.
                </p>
              </TabsContent>

              <TabsContent value="game_night" className="mt-4">
                <p className="text-sm text-muted-foreground">
                  Schedule a game night event with voting, date/time, and RSVP tracking.
                </p>
              </TabsContent>
            </Tabs>

            {/* Title */}
            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Poll Title</FormLabel>
                  <FormControl>
                    <Input 
                      placeholder={pollType === "quick" ? "What should we play?" : "Friday Game Night"} 
                      {...field} 
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Description */}
            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description (optional)</FormLabel>
                  <FormControl>
                    <Textarea 
                      placeholder="Add any details about this poll..."
                      className="resize-none"
                      {...field} 
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Game Night specific fields */}
            {pollType === "game_night" && (
              <div className="grid md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="eventDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Event Date & Time</FormLabel>
                      <Popover>
                        <PopoverTrigger asChild>
                          <FormControl>
                            <Button
                              variant="outline"
                              className={cn(
                                "w-full pl-3 text-left font-normal",
                                !field.value && "text-muted-foreground"
                              )}
                            >
                              {field.value ? (
                                format(field.value, "PPP")
                              ) : (
                                <span>Pick a date</span>
                              )}
                              <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                            </Button>
                          </FormControl>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar
                            mode="single"
                            selected={field.value}
                            onSelect={field.onChange}
                            disabled={(date) => date < new Date()}
                            initialFocus
                          />
                        </PopoverContent>
                      </Popover>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="eventLocation"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Location</FormLabel>
                      <FormControl>
                        <Input placeholder="My place, Discord, etc." {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            )}

            {/* Voting ends at */}
            <FormField
              control={form.control}
              name="votingEndsAt"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Voting Deadline (optional)</FormLabel>
                  <Popover>
                    <PopoverTrigger asChild>
                      <FormControl>
                        <Button
                          variant="outline"
                          className={cn(
                            "w-full pl-3 text-left font-normal",
                            !field.value && "text-muted-foreground"
                          )}
                        >
                          {field.value ? (
                            format(field.value, "PPP")
                          ) : (
                            <span>No deadline</span>
                          )}
                          <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                        </Button>
                      </FormControl>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={field.value}
                        onSelect={field.onChange}
                        disabled={(date) => date < new Date()}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                  <FormDescription>
                    Voting will automatically close at midnight on this date
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Settings */}
            <div className="grid md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="maxVotesPerUser"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Votes per person</FormLabel>
                    <FormControl>
                      <Input 
                        type="number" 
                        min={1} 
                        max={10}
                        {...field}
                        onChange={(e) => field.onChange(parseInt(e.target.value) || 1)}
                      />
                    </FormControl>
                    <FormDescription>
                      How many games can each person vote for
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="showResultsBeforeClose"
                render={({ field }) => (
                  <FormItem className="flex flex-col">
                    <FormLabel>Show live results</FormLabel>
                    <div className="flex items-center gap-2">
                      <FormControl>
                        <Switch
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                      <span className="text-sm text-muted-foreground">
                        {field.value ? "Yes" : "Hidden until closed"}
                      </span>
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Game Selection */}
            <FormField
              control={form.control}
              name="gameIds"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Select Games (2-10)</FormLabel>
                  <FormControl>
                    <GameSelectorForPoll
                      libraryId={libraryId}
                      selectedGameIds={field.value}
                      onSelectionChange={field.onChange}
                      maxGames={10}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex justify-end gap-3 pt-4">
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={createPoll.isPending}>
                {createPoll.isPending ? "Creating..." : "Create Poll"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
