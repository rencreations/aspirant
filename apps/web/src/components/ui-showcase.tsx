"use client";

import { BellIcon, CheckIcon } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@aspirant/ui/components/accordion";
import { Avatar, AvatarFallback } from "@aspirant/ui/components/avatar";
import { Badge } from "@aspirant/ui/components/badge";
import { Button } from "@aspirant/ui/components/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@aspirant/ui/components/card";
import { Checkbox } from "@aspirant/ui/components/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@aspirant/ui/components/dialog";
import { Label } from "@aspirant/ui/components/label";
import { Progress } from "@aspirant/ui/components/progress";
import { Separator } from "@aspirant/ui/components/separator";
import { Skeleton } from "@aspirant/ui/components/skeleton";
import { Slider } from "@aspirant/ui/components/slider";
import { Switch } from "@aspirant/ui/components/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@aspirant/ui/components/tabs";
import { Tooltip, TooltipContent, TooltipTrigger } from "@aspirant/ui/components/tooltip";

import { ContactForm } from "@/components/contact-form";
import { useUiStore } from "@/stores/ui-store";

export function UiShowcase() {
  const [volume, setVolume] = useState([40]);
  const reducedEffects = useUiStore((s) => s.reducedEffects);
  const setReducedEffects = useUiStore((s) => s.setReducedEffects);

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>Buttons and badges</CardTitle>
          <CardDescription>Variants from the shared @aspirant/ui package.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          <div className="flex flex-wrap gap-2">
            <Button>Default</Button>
            <Button variant="secondary">Secondary</Button>
            <Button variant="outline">Outline</Button>
            <Button variant="ghost">Ghost</Button>
            <Button variant="destructive">Destructive</Button>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge>Default</Badge>
            <Badge variant="secondary">Secondary</Badge>
            <Badge variant="outline">Outline</Badge>
            <Avatar>
              <AvatarFallback>AS</AvatarFallback>
            </Avatar>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="outline" size="icon" aria-label="Notifications">
                  <BellIcon />
                </Button>
              </TooltipTrigger>
              <TooltipContent>You have no new notifications</TooltipContent>
            </Tooltip>
          </div>
          <Separator />
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              onClick={() => toast("Event created", { description: "Sunday, 10:00" })}
            >
              Show toast
            </Button>
            <Dialog>
              <DialogTrigger asChild>
                <Button variant="outline">Open dialog</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Accessible dialog</DialogTitle>
                  <DialogDescription>
                    Focus is trapped and Escape closes it. Built on Radix.
                  </DialogDescription>
                </DialogHeader>
                <DialogFooter>
                  <Button onClick={() => toast.success("Confirmed")}>
                    <CheckIcon /> Confirm
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Controls</CardTitle>
          <CardDescription>Inputs, switches and feedback components.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-5">
          <div className="flex items-center justify-between gap-4">
            <Label htmlFor="reduced">Reduce 3D and motion effects</Label>
            <Switch id="reduced" checked={reducedEffects} onCheckedChange={setReducedEffects} />
          </div>
          <div className="flex items-center gap-2">
            <Checkbox id="terms" defaultChecked />
            <Label htmlFor="terms">Accept terms</Label>
          </div>
          <div className="grid gap-3">
            <Label htmlFor="volume">Volume: {volume[0]}</Label>
            <Slider
              id="volume"
              value={volume}
              onValueChange={setVolume}
              max={100}
              step={1}
              aria-label="Volume"
            />
            <Progress value={volume[0] ?? 0} aria-label="Volume level" />
          </div>
          <div className="flex items-center gap-3">
            <Skeleton className="size-10 rounded-full" />
            <div className="grid flex-1 gap-2">
              <Skeleton className="h-3 w-3/4" />
              <Skeleton className="h-3 w-1/2" />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Tabs and accordion</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4">
          <Tabs defaultValue="one">
            <TabsList>
              <TabsTrigger value="one">One</TabsTrigger>
              <TabsTrigger value="two">Two</TabsTrigger>
            </TabsList>
            <TabsContent value="one" className="text-sm text-muted-foreground">
              The first panel.
            </TabsContent>
            <TabsContent value="two" className="text-sm text-muted-foreground">
              The second panel.
            </TabsContent>
          </Tabs>
          <Accordion type="single" collapsible>
            <AccordionItem value="a">
              <AccordionTrigger>Is it accessible?</AccordionTrigger>
              <AccordionContent>Yes. It follows the WAI-ARIA design pattern.</AccordionContent>
            </AccordionItem>
            <AccordionItem value="b">
              <AccordionTrigger>Is it static-export safe?</AccordionTrigger>
              <AccordionContent>
                Everything here runs in the browser; no server is required.
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Validated form</CardTitle>
          <CardDescription>TanStack Form with a Zod schema.</CardDescription>
        </CardHeader>
        <CardContent>
          <ContactForm />
        </CardContent>
      </Card>
    </div>
  );
}
