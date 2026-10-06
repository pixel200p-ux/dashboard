import { useEffect, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { EDIT_PIN_REQUEST_EVENT } from "@/lib/edit-pin";
import { ShieldCheck } from "lucide-react";

type PinResolver = (pin: string | null) => void;
type PinRequestEvent = CustomEvent<{ resolve: PinResolver }>;

export function EditPinDialog() {
  const [resolvers, setResolvers] = useState<PinResolver[]>([]);
  const [pin, setPin] = useState("");
  const resolver = resolvers[0];

  useEffect(() => {
    function handleRequest(event: Event) {
      const request = event as PinRequestEvent;
      setResolvers((current) => [...current, request.detail.resolve]);
    }

    window.addEventListener(EDIT_PIN_REQUEST_EVENT, handleRequest);
    return () => window.removeEventListener(EDIT_PIN_REQUEST_EVENT, handleRequest);
  }, []);

  function complete(value: string | null) {
    if (!resolver) return;
    resolver(value);
    setPin("");
    setResolvers((current) => current.slice(1));
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (/^\d{6}$/.test(pin)) complete(pin);
  }

  return (
    <Dialog
      open={Boolean(resolver)}
      onOpenChange={(open) => {
        if (!open) complete(null);
      }}
    >
      <DialogContent title="Nhập mã bảo vệ">
        <form className="mx-auto max-w-sm space-y-4 py-2" onSubmit={submit}>
          <div className="text-center">
            <ShieldCheck className="mx-auto h-8 w-8 text-primary" />
            <p className="font-medium">Nhập mã bảo vệ</p>
            <p className="mt-1 text-sm text-muted-foreground">Mã PIN gồm 6 chữ số</p>
          </div>
          <Input
            autoFocus
            aria-label="Mã PIN"
            autoComplete="one-time-code"
            inputMode="numeric"
            maxLength={6}
            placeholder="••••••"
            type="password"
            value={pin}
            onChange={(event) => setPin(event.target.value.replace(/\D/g, "").slice(0, 6))}
          />
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => complete(null)}>
              Hủy
            </Button>
            <Button type="submit" disabled={pin.length !== 6}>
              Xác nhận
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
