"use client";

import InputBase from "@mui/material/InputBase";
import Divider from "@mui/material/Divider";
import IconButton from "@mui/material/IconButton";
import { QrCodeIcon } from "@heroicons/react/24/solid";
import { ClipboardDocumentIcon } from "@heroicons/react/24/outline";
import { checkAddress } from "nanocurrency";

const validate = (value: string) => checkAddress(value);

export interface AddressInputProps {
  onSubmit?: (event: React.FormEvent<HTMLFormElement>) => void;
  onChange?: (event: React.ChangeEvent<HTMLInputElement>) => void;
  onValidAddress?: (address: string) => void;
  onInvalidAddress?: (text: string) => void;
}

export default function AddressInput({
  onSubmit,
  onChange,
  onValidAddress,
  onInvalidAddress,
}: AddressInputProps) {
  const handle = (event: React.ChangeEvent<HTMLInputElement>) => {
    onChange && onChange(event);
    const value = event.target.value;
    if (validate(value)) {
      onValidAddress && onValidAddress(value);
    } else {
      onInvalidAddress && onInvalidAddress(value);
    }
  };

  return (
    <form
      className="w-full p-2 flex items-center rounded-md border border-slate-200"
      action={"#"}
      onSubmit={onSubmit}
    >
      <InputBase
        id="nano-address"
        sx={{ ml: 1, flex: 1 }}
        placeholder="Your Nano address: nano_"
        inputProps={{ "aria-label": "your nano address" }}
        onChange={handle}
      />
      <IconButton
        type="button"
        sx={{ p: "10px" }}
        className="hiddenx"
        aria-label="search"
      >
        <QrCodeIcon className="w-5 h-5 text-gray-500" />
      </IconButton>
      <Divider sx={{ height: 28, m: 0.5 }} orientation="vertical" />
      <IconButton color="primary" sx={{ p: "10px" }} aria-label="directions">
        <ClipboardDocumentIcon className="w-5 h-5 text-gray-600" />
      </IconButton>
    </form>
  );
}
