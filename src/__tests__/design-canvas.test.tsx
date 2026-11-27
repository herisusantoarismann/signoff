import React from "react";
import { describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { DesignCanvas } from "@/components/organisms/DesignCanvas";
import { BeforeAfterSlider } from "@/components/organisms/BeforeAfterSlider";
import { ThreadSidebar } from "@/components/organisms/ThreadSidebar";
import { ApprovalDialog } from "@/components/molecules/ApprovalDialog";
import { createInitialDemoBundle } from "@/lib/demo/demo-store";

describe("UI Organisms & Molecules (Atomic Design, positive & edge workflows)", () => {
  it("switches between Pin, Box, Geser tools, clamps zoom 50%-300%, and toggles Intip Pin v1", () => {
    const bundle = createInitialDemoBundle("client");
    const frameV2 = bundle.frames.find((f) => f.id === "demo-frame-v2-hero")!;
    const v2Pins = bundle.pins.filter((p) => p.frame_id === frameV2.id);
    const v1Pins = bundle.pins.filter((p) => p.frame_id === "demo-frame-v1-hero");

    const onToolChange = vi.fn();
    const onTogglePeekPrevious = vi.fn();

    render(
      <DesignCanvas
        frame={frameV2}
        pins={v2Pins}
        ghostPins={v1Pins}
        selectedPinId={null}
        locked={false}
        tool="pin"
        onToolChange={onToolChange}
        hideResolved={false}
        onToggleHideResolved={vi.fn()}
        peekPreviousPins={false}
        canPeekPrevious={true}
        onTogglePeekPrevious={onTogglePeekPrevious}
        onSelectPin={vi.fn()}
        onCreatePin={vi.fn()}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: /Box/i }));
    expect(onToolChange).toHaveBeenCalledWith("box");

    fireEvent.click(screen.getByRole("button", { name: /Geser/i }));
    expect(onToolChange).toHaveBeenCalledWith("pan");

    fireEvent.click(screen.getByRole("button", { name: /Intip Pin v1/i }));
    expect(onTogglePeekPrevious).toHaveBeenCalledTimes(1);

    // Zoom bounds check: repeated zoom-out stops at 50%; repeated zoom-in stops at 300%
    const zoomOut = screen.getByRole("button", { name: "Perkecil" });
    const zoomIn = screen.getByRole("button", { name: "Perbesar" });
    for (let i = 0; i < 6; i++) fireEvent.click(zoomOut);
    expect(screen.getByText("50%")).toBeInTheDocument();
    for (let i = 0; i < 15; i++) fireEvent.click(zoomIn);
    expect(screen.getByText("300%")).toBeInTheDocument();
  });

  it("opens composer when clicking loaded canvas, rejects blank input, and cancels on Escape", async () => {
    const bundle = createInitialDemoBundle("client");
    const frameV2 = bundle.frames.find((f) => f.id === "demo-frame-v2-hero")!;
    const onCreatePin = vi.fn();

    render(
      <DesignCanvas
        frame={frameV2}
        pins={[]}
        selectedPinId={null}
        locked={false}
        tool="pin"
        onToolChange={vi.fn()}
        hideResolved={false}
        onToggleHideResolved={vi.fn()}
        peekPreviousPins={false}
        canPeekPrevious={false}
        onTogglePeekPrevious={vi.fn()}
        onSelectPin={vi.fn()}
        onCreatePin={onCreatePin}
      />
    );

    // Mark image ready as browser does on load
    const img = screen.getByAltText(frameV2.title);
    fireEvent.load(img);

    const surface = screen.getByTestId("canvas-surface");
    vi.spyOn(surface, "getBoundingClientRect").mockReturnValue({
      left: 0,
      top: 0,
      width: 1000,
      height: 500,
      right: 1000,
      bottom: 500,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    });

    fireEvent(
      surface,
      new MouseEvent("pointerup", { bubbles: true, clientX: 500, clientY: 250 })
    );
    const textarea = screen.getByPlaceholderText(/Tulis revisi spesifik/i);
    const saveBtn = screen.getByRole("button", { name: "Simpan" });

    // Whitespace-only input keeps Simpan disabled
    fireEvent.change(textarea, { target: { value: "    " } });
    expect(saveBtn).toBeDisabled();

    // Pressing Escape inside composer cleanly cancels
    fireEvent.keyDown(window, { key: "Escape" });
    expect(screen.queryByPlaceholderText(/Tulis revisi spesifik/i)).toBeNull();
    expect(onCreatePin).not.toHaveBeenCalled();

    // Re-open, fill valid comment, and submit
    fireEvent(
      surface,
      new MouseEvent("pointerup", { bubbles: true, clientX: 250, clientY: 125 })
    );
    fireEvent.change(screen.getByPlaceholderText(/Tulis revisi spesifik/i), {
      target: { value: "Besarkan tombol pesan" },
    });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Simpan" }));
    });
    expect(onCreatePin).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: "point",
        xNorm: 0.25,
        yNorm: 0.25,
        body: "Besarkan tombol pesan",
      })
    );
  });

  it("hides Pin and Box creation tools when canvas is locked", () => {
    const bundle = createInitialDemoBundle("client");
    const frameV2 = bundle.frames.find((f) => f.id === "demo-frame-v2-hero")!;

    render(
      <DesignCanvas
        frame={frameV2}
        pins={[]}
        selectedPinId={null}
        locked={true}
        lockedReason="Versi sudah disetujui."
        tool="pin"
        onToolChange={vi.fn()}
        hideResolved={false}
        onToggleHideResolved={vi.fn()}
        peekPreviousPins={false}
        canPeekPrevious={false}
        onTogglePeekPrevious={vi.fn()}
        onSelectPin={vi.fn()}
        onCreatePin={vi.fn()}
      />
    );

    expect(screen.queryByRole("button", { name: /^Pin$/i })).toBeNull();
    expect(screen.queryByRole("button", { name: /^Box$/i })).toBeNull();
    expect(screen.getByRole("button", { name: /Geser/i })).toBeInTheDocument();
  });

  it("updates BeforeAfterSlider clipPath via keyboard navigation and handles missing matching frame", () => {
    const bundle = createInitialDemoBundle("client");
    const { rerender } = render(
      <BeforeAfterSlider
        open={true}
        versions={bundle.versions}
        frames={bundle.frames}
        initialFrameTitle="01. Hero & Menu Desktop"
        onClose={vi.fn()}
      />
    );

    const slider = screen.getByRole("slider", { name: /Pembatas Before After/i });
    expect(slider).toHaveAttribute("aria-valuenow", "50");

    fireEvent.keyDown(slider, { key: "ArrowRight" });
    expect(slider).toHaveAttribute("aria-valuenow", "54");
    expect(screen.getByTestId("before-after-overlay")).toHaveStyle({
      clipPath: "inset(0 46% 0 0)",
    });

    // Edge case: frame exists only in one version
    rerender(
      <BeforeAfterSlider
        open={true}
        versions={bundle.versions}
        frames={bundle.frames.filter((f) => f.version_id === "demo-ver-v2")}
        initialFrameTitle="01. Hero & Menu Desktop"
        onClose={vi.fn()}
      />
    );
    expect(screen.getByText(/hanya ada di salah satu versi/i)).toBeInTheDocument();
  });

  it("renders ThreadSidebar filters, deleted comments, client reopen, and sticky draft CTA", () => {
    const bundle = createInitialDemoBundle("client");
    const basePin = bundle.pins.find((p) => p.id === "demo-pin-2")!;
    const resolvedOwnPin = {
      ...basePin,
      id: "pin-own-res",
      pin_number: 4,
      status: "resolved" as const,
      comments: [
        {
          ...basePin.comments[0],
          id: "c-deleted",
          body: "",
          deleted_at: "2026-11-26T15:00:00Z",
        },
      ],
    };

    const onChangePinStatus = vi.fn();
    const onSubmitDrafts = vi.fn();

    render(
      <ThreadSidebar
        pins={[basePin, resolvedOwnPin]}
        activities={bundle.activities}
        versionNotes="Perbaikan kontras tombol."
        versionLabel="v2"
        actorRole="client"
        actorGuestId={bundle.actor.guestId}
        locked={false}
        selectedPinId="pin-own-res"
        onSelectPin={vi.fn()}
        onCopyPinLink={vi.fn()}
        onChangePinStatus={onChangePinStatus}
        onDeletePin={vi.fn()}
        onAddReply={vi.fn()}
        onEditComment={vi.fn()}
        onDeleteComment={vi.fn()}
        draftCount={2}
        submittingDrafts={false}
        onSubmitDrafts={onSubmitDrafts}
        mobileSheetOpen={true}
        onToggleMobileSheet={vi.fn()}
      />
    );

    expect(screen.getByText("Komentar dihapus")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Buka lagi/i }));
    expect(onChangePinStatus).toHaveBeenCalledWith("pin-own-res", "open");

    fireEvent.click(screen.getByRole("button", { name: /Kirim Semua Feedback \(2\)/i }));
    expect(onSubmitDrafts).toHaveBeenCalledTimes(1);

    // Filter by resolved shows count matching resolved pins
    fireEvent.change(screen.getByLabelText("Filter status"), { target: { value: "resolved" } });
    expect(screen.queryByText(/Boleh cek ulang/)).toBeNull();

    // Switch to Aktivitas tab shows release notes
    fireEvent.click(screen.getByRole("button", { name: "Aktivitas" }));
    expect(screen.getByText("Perbaikan kontras tombol.")).toBeInTheDocument();
  });

  it("gates ApprovalDialog submit until exact name and checkbox are checked, and offers send-drafts shortcut", () => {
    const onConfirm = vi.fn();
    const onSendDraftsFirst = vi.fn();
    render(
      <ApprovalDialog
        open={true}
        versionLabel="v2"
        actorName="Budi — KopiKita"
        unsentDraftCount={1}
        onConfirm={onConfirm}
        onSendDraftsFirst={onSendDraftsFirst}
        onClose={vi.fn()}
      />
    );

    const submitBtn = screen.getByRole("button", { name: /Approve Versi Ini/i });
    expect(submitBtn).toBeDisabled();

    fireEvent.click(screen.getByRole("button", { name: /Kirim draft dulu sebelum ACC/i }));
    expect(onSendDraftsFirst).toHaveBeenCalledTimes(1);

    fireEvent.change(screen.getByPlaceholderText("Budi — KopiKita"), {
      target: { value: "wrong name" },
    });
    expect(screen.getByText(/Harus sesuai/)).toBeInTheDocument();

    fireEvent.change(screen.getByPlaceholderText("Budi — KopiKita"), {
      target: { value: "  budi — kopikita " },
    });
    expect(submitBtn).toBeDisabled();

    fireEvent.click(screen.getByRole("checkbox"));
    expect(submitBtn).not.toBeDisabled();

    fireEvent.click(submitBtn);
    expect(onConfirm).toHaveBeenCalledWith("budi — kopikita");
  });
});
