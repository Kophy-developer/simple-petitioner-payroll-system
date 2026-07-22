"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Card, CardBody } from "@/components/ui/card";
import { expenseTypeLabels } from "@/lib/demo-data";
import { formatCurrency } from "@/lib/format";
import {
  createExpense,
  createLodgingExpense,
  listIssues,
  suggestedExpenseAmount,
  uploadReceipt,
} from "@/lib/api/live";
import { listLodgingProperties } from "@/lib/api/remodel";
import { lodgingDailyShare } from "@/lib/payroll-math";
import type { ExpenseType, Issue, LodgingKind, LodgingProperty } from "@/lib/types";

const rangeTypes: ExpenseType[] = ["hotel_travel", "car_rental", "housing"];
const lodgingTypes: ExpenseType[] = ["housing", "hotel_travel"];

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function rangeLabels(type: ExpenseType) {
  if (type === "hotel_travel" || type === "housing") return { start: "Check-in", end: "Check-out" };
  if (type === "car_rental") return { start: "Pick-up", end: "Return" };
  return { start: "Start date", end: "End date" };
}

function lodgingKindForType(type: ExpenseType): LodgingKind {
  return type === "hotel_travel" ? "hotel" : "airbnb";
}

export default function NewExpensePage() {
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [type, setType] = useState<ExpenseType>("upfront_draw");
  const [amount, setAmount] = useState("");
  const [startDate, setStartDate] = useState(todayIso());
  const [endDate, setEndDate] = useState("");
  const [issueId, setIssueId] = useState("");
  const [issues, setIssues] = useState<Issue[]>([]);
  const [dateError, setDateError] = useState("");
  const [error, setError] = useState("");
  const [suggested, setSuggested] = useState<number | undefined>();
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [tollsAmount, setTollsAmount] = useState("0");
  const [carActive, setCarActive] = useState(true);
  const [properties, setProperties] = useState<LodgingProperty[]>([]);
  const [propertyQuery, setPropertyQuery] = useState("");
  const [propertyId, setPropertyId] = useState("");
  const [creatingProperty, setCreatingProperty] = useState(false);
  const [dailyTotal, setDailyTotal] = useState("");
  const [roomCount, setRoomCount] = useState("1");
  const [roomRate, setRoomRate] = useState("");
  const [roomNumber, setRoomNumber] = useState("");
  const [occupants, setOccupants] = useState("1");

  const usesRange = rangeTypes.includes(type);
  const isLodging = lodgingTypes.includes(type);
  const labels = rangeLabels(type);
  const kind = lodgingKindForType(type);

  useEffect(() => {
    void listIssues()
      .then((rows) => {
        setIssues(rows);
        if (rows[0]) setIssueId(rows[0].id);
      })
      .catch(() => setIssues([]));
  }, []);

  useEffect(() => {
    if (!isLodging) {
      setProperties([]);
      return;
    }
    void listLodgingProperties(kind)
      .then(setProperties)
      .catch(() => setProperties([]));
  }, [isLodging, kind]);

  useEffect(() => {
    if (type !== "car_rental") {
      setSuggested(undefined);
      return;
    }
    void suggestedExpenseAmount(type, issueId || null)
      .then((value) => {
        setSuggested(value);
        if (value !== undefined) setAmount(String(value));
      })
      .catch(() => setSuggested(undefined));
  }, [type, issueId]);

  const selectedProperty = useMemo(
    () => properties.find((p) => p.id === propertyId) ?? null,
    [properties, propertyId],
  );

  const filteredProperties = useMemo(() => {
    const q = propertyQuery.trim().toLowerCase();
    if (!q) return properties.slice(0, 12);
    return properties.filter((p) => p.name.toLowerCase().includes(q)).slice(0, 12);
  }, [properties, propertyQuery]);

  const sharePreview = useMemo(() => {
    if (!isLodging) return undefined;
    const occ = parseInt(occupants, 10) || 1;
    if (creatingProperty || !selectedProperty) {
      return lodgingDailyShare({
        kind,
        dailyTotal: kind === "airbnb" ? parseFloat(dailyTotal) || 0 : null,
        roomCount: kind === "airbnb" ? parseInt(roomCount, 10) || 1 : null,
        roomRate: kind === "hotel" ? parseFloat(roomRate) || 0 : null,
        occupantsInRoom: occ,
      });
    }
    return lodgingDailyShare({
      kind: selectedProperty.kind,
      dailyTotal: selectedProperty.dailyTotal,
      roomCount: selectedProperty.roomCount,
      roomRate: selectedProperty.roomRate,
      occupantsInRoom: occ,
    });
  }, [
    isLodging,
    creatingProperty,
    selectedProperty,
    kind,
    dailyTotal,
    roomCount,
    roomRate,
    occupants,
  ]);

  useEffect(() => {
    if (!isLodging || sharePreview === undefined) return;
    setAmount(String(sharePreview));
  }, [isLodging, sharePreview]);

  function handleTypeChange(next: ExpenseType) {
    setType(next);
    setDateError("");
    setPropertyId("");
    setPropertyQuery("");
    setCreatingProperty(false);
    if (lodgingTypes.includes(next)) {
      setEndDate("");
    } else if (rangeTypes.includes(next) && !endDate) {
      setEndDate(startDate);
    }
  }

  function handleStartChange(value: string) {
    setStartDate(value);
    setDateError("");
    if (usesRange && endDate && endDate < value) setEndDate(value);
  }

  function handleEndChange(value: string) {
    setEndDate(value);
    if (value && value < startDate) {
      setDateError("End date cannot be before the start date.");
      return;
    }
    setDateError("");
  }

  function pickProperty(prop: LodgingProperty) {
    setPropertyId(prop.id);
    setPropertyQuery(prop.name);
    setCreatingProperty(false);
    if (prop.kind === "airbnb") {
      setDailyTotal(prop.dailyTotal != null ? String(prop.dailyTotal) : "");
      setRoomCount(prop.roomCount != null ? String(prop.roomCount) : "1");
    } else {
      setRoomRate(prop.roomRate != null ? String(prop.roomRate) : "");
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (usesRange && endDate && endDate < startDate) {
      setDateError("End date cannot be before the start date.");
      return;
    }
    if (isLodging) {
      if (creatingProperty && !propertyQuery.trim()) {
        setError("Enter the Airbnb or hotel name.");
        return;
      }
      if (!creatingProperty && !propertyId) {
        setError("Select an existing property or create a new one.");
        return;
      }
    }
    setSaving(true);
    setError("");
    try {
      let receiptPath: string | null = null;
      if (receiptFile) {
        receiptPath = await uploadReceipt(receiptFile);
      }
      if (isLodging) {
        await createLodgingExpense({
          kind,
          propertyId: creatingProperty ? null : propertyId,
          propertyName: creatingProperty ? propertyQuery.trim() : null,
          dailyTotal: kind === "airbnb" ? parseFloat(dailyTotal) || 0 : null,
          roomCount: kind === "airbnb" ? parseInt(roomCount, 10) || 1 : null,
          roomRate: kind === "hotel" ? parseFloat(roomRate) || 0 : null,
          roomNumber,
          occupantsInRoom: parseInt(occupants, 10) || 1,
          checkInDate: startDate,
          checkOutDate: endDate || null,
          amount: amount === "" ? null : parseFloat(amount),
          issueId: issueId || null,
          receiptPath,
        });
      } else {
        await createExpense({
          type,
          amount: amount === "" ? null : parseFloat(amount),
          expenseDate: startDate,
          endDate: usesRange ? endDate || null : null,
          issueId: issueId || null,
          receiptPath,
          tollsAmount: type === "car_rental" ? parseFloat(tollsAmount) || 0 : 0,
          carActive: type === "car_rental" ? carActive : false,
        });
      }
      setSaved(true);
      setTimeout(() => {
        window.location.href = "/payroll";
      }, 900);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save expense.");
      setSaving(false);
    }
  }

  const issueLabel = useMemo(
    () => issues.find((i) => i.id === issueId)?.issueNumber,
    [issues, issueId],
  );

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Payroll"
        title="Add Expense"
        description="Log a receipt-backed expense. Airbnb and hotel stays check you in on Field Operations automatically."
        actions={
          <Link href="/payroll" className="text-sm text-civic-navy hover:underline">
            Back to payroll
          </Link>
        }
      />
      <Card className="max-w-xl">
        <CardBody>
          <form className="space-y-4" onSubmit={(e) => void handleSubmit(e)}>
            <div className="space-y-2">
              <Label htmlFor="expense-type">Type</Label>
              <Select
                id="expense-type"
                value={type}
                onChange={(e) => handleTypeChange(e.target.value as ExpenseType)}
              >
                {Object.entries(expenseTypeLabels).map(([key, label]) => (
                  <option key={key} value={key}>
                    {label}
                  </option>
                ))}
              </Select>
            </div>

            {(type === "car_rental" || type === "housing" || type === "hotel_travel" || type === "chargeback") && issues.length > 0 ? (
              <div className="space-y-2">
                <Label htmlFor="issue">Issue (optional)</Label>
                <Select id="issue" value={issueId} onChange={(e) => setIssueId(e.target.value)}>
                  {issues.map((i) => (
                    <option key={i.id} value={i.id}>
                      {i.issueNumber}
                    </option>
                  ))}
                </Select>
              </div>
            ) : null}

            {isLodging ? (
              <div className="space-y-3 rounded-xl border border-ink/10 bg-white/50 p-4">
                <p className="text-xs uppercase tracking-[0.2em] text-ink/50">
                  {kind === "airbnb" ? "Airbnb" : "Hotel"} property
                </p>
                <div className="space-y-2">
                  <Label htmlFor="property-query">Property name</Label>
                  <Input
                    id="property-query"
                    value={propertyQuery}
                    onChange={(e) => {
                      setPropertyQuery(e.target.value);
                      setPropertyId("");
                      setCreatingProperty(false);
                    }}
                    placeholder={`Search or type ${kind === "airbnb" ? "Airbnb" : "hotel"} name`}
                    required
                  />
                </div>
                {filteredProperties.length > 0 && !creatingProperty ? (
                  <div className="max-h-40 space-y-1 overflow-y-auto rounded-lg border border-ink/10 bg-white p-2">
                    {filteredProperties.map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        className={`block w-full rounded-md px-3 py-2 text-left text-sm hover:bg-civic-navy/5 ${
                          propertyId === p.id ? "bg-civic-navy/10 font-medium" : ""
                        }`}
                        onClick={() => pickProperty(p)}
                      >
                        {p.name}
                      </button>
                    ))}
                  </div>
                ) : null}
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant={creatingProperty ? "primary" : "ghost"}
                    onClick={() => {
                      setCreatingProperty(true);
                      setPropertyId("");
                    }}
                    disabled={!propertyQuery.trim()}
                  >
                    Use new name
                  </Button>
                  {propertyId ? (
                    <p className="self-center text-xs text-success">Using existing property</p>
                  ) : null}
                  {creatingProperty ? (
                    <p className="self-center text-xs text-ink/55">Creates catalog entry for everyone</p>
                  ) : null}
                </div>
                {kind === "airbnb" ? (
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="daily-total">Daily total</Label>
                      <Input
                        id="daily-total"
                        type="number"
                        step="0.01"
                        min={0}
                        required={creatingProperty || !selectedProperty}
                        value={dailyTotal}
                        onChange={(e) => setDailyTotal(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="room-count">Rooms in property</Label>
                      <Input
                        id="room-count"
                        type="number"
                        min={1}
                        required={creatingProperty || !selectedProperty}
                        value={roomCount}
                        onChange={(e) => setRoomCount(e.target.value)}
                      />
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <Label htmlFor="room-rate">Room rate (daily)</Label>
                    <Input
                      id="room-rate"
                      type="number"
                      step="0.01"
                      min={0}
                      required={creatingProperty || !selectedProperty}
                      value={roomRate}
                      onChange={(e) => setRoomRate(e.target.value)}
                    />
                  </div>
                )}
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="room-number">Room #</Label>
                    <Input
                      id="room-number"
                      value={roomNumber}
                      onChange={(e) => setRoomNumber(e.target.value)}
                      placeholder="Optional"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="occupants">Occupants in room</Label>
                    <Input
                      id="occupants"
                      type="number"
                      min={1}
                      required
                      value={occupants}
                      onChange={(e) => setOccupants(e.target.value)}
                    />
                  </div>
                </div>
                {sharePreview !== undefined ? (
                  <p className="text-xs text-ink/55">
                    Daily share calculated: {formatCurrency(sharePreview)}. You can override the amount below.
                  </p>
                ) : null}
              </div>
            ) : null}

            <div className="space-y-2">
              <Label htmlFor="amount">Amount</Label>
              <Input
                id="amount"
                type="number"
                step="0.01"
                min={0}
                required={suggested === undefined && !isLodging}
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder={suggested !== undefined ? formatCurrency(suggested) : undefined}
              />
              {suggested !== undefined && type === "car_rental" ? (
                <p className="text-xs text-ink/50">
                  Suggested from config{issueLabel ? ` (${issueLabel})` : ""}: {formatCurrency(suggested)}. You can override.
                </p>
              ) : null}
            </div>

            {usesRange ? (
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="start-date">{labels.start}</Label>
                  <Input
                    id="start-date"
                    type="date"
                    required
                    value={startDate}
                    onChange={(e) => handleStartChange(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="end-date">
                    {labels.end}
                    {isLodging ? " (optional if still staying)" : ""}
                  </Label>
                  <Input
                    id="end-date"
                    type="date"
                    required={!isLodging}
                    min={startDate}
                    value={endDate}
                    onChange={(e) => handleEndChange(e.target.value)}
                  />
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                <Label htmlFor="date">Date</Label>
                <Input
                  id="date"
                  type="date"
                  required
                  value={startDate}
                  onChange={(e) => handleStartChange(e.target.value)}
                />
              </div>
            )}

            {dateError ? (
              <p className="rounded-xl bg-danger/10 px-4 py-3 text-sm text-danger">{dateError}</p>
            ) : null}
            {error ? (
              <p className="rounded-xl bg-danger/10 px-4 py-3 text-sm text-danger">{error}</p>
            ) : null}

            {usesRange && !isLodging ? (
              <p className="text-xs text-ink/50">
                {labels.end} can be the same day as {labels.start.toLowerCase()}, but not earlier.
              </p>
            ) : null}
            {isLodging ? (
              <p className="text-xs text-ink/50">
                Leave check-out blank if you are still staying. Check out later from Payroll. This stay appears on the Field Operations board.
              </p>
            ) : null}

            {type === "car_rental" ? (
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="tolls">Tolls</Label>
                  <Input
                    id="tolls"
                    type="number"
                    step="0.01"
                    min={0}
                    value={tollsAmount}
                    onChange={(e) => setTollsAmount(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="car-active">Show on Field Operations board</Label>
                  <Select
                    id="car-active"
                    value={carActive ? "yes" : "no"}
                    onChange={(e) => setCarActive(e.target.value === "yes")}
                  >
                    <option value="yes">Yes — active rental</option>
                    <option value="no">No</option>
                  </Select>
                </div>
              </div>
            ) : null}

            <div className="space-y-2">
              <Label htmlFor="receipt">Receipt</Label>
              <Input
                id="receipt"
                type="file"
                accept="image/*,.pdf"
                onChange={(e) => setReceiptFile(e.target.files?.[0] ?? null)}
              />
              {receiptFile ? (
                <p className="text-xs text-ink/55">Selected: {receiptFile.name}</p>
              ) : null}
            </div>

            <Button type="submit" className="w-full" disabled={!!dateError || saving || saved}>
              {saved ? "Saved — redirecting…" : saving ? "Saving…" : "Save expense"}
            </Button>
          </form>
        </CardBody>
      </Card>
    </div>
  );
}
