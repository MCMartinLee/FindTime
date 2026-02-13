import { useMemo, useState } from "react";
import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { useNavigate } from "react-router-dom";
import { db, firebaseMissingConfig, firebaseReady } from "../firebase";
import { browserTimezone, toUtcIsoFromLocalInput } from "../utils/time";

function makeEmptySlot() {
  return {
    id: `${Date.now()}_${Math.random().toString(16).slice(2, 8)}`,
    localDateTime: ""
  };
}

function CreateEventPage() {
  const navigate = useNavigate();
  const [title, setTitle] = useState("");
  const [timezone, setTimezone] = useState(browserTimezone());
  const [slots, setSlots] = useState([makeEmptySlot(), makeEmptySlot()]);
  const [error, setError] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const usableSlots = useMemo(
    () => slots.filter((slot) => Boolean(toUtcIsoFromLocalInput(slot.localDateTime))),
    [slots]
  );

  const canCreate = title.trim().length > 0 && usableSlots.length > 0 && firebaseReady && !isSaving;

  const addSlot = () => setSlots((prev) => [...prev, makeEmptySlot()]);

  const updateSlot = (slotId, value) => {
    setSlots((prev) =>
      prev.map((slot) => (slot.id === slotId ? { ...slot, localDateTime: value } : slot))
    );
  };

  const removeSlot = (slotId) => {
    setSlots((prev) => prev.filter((slot) => slot.id !== slotId));
  };

  const submit = async (event) => {
    event.preventDefault();
    setError("");

    if (!canCreate) {
      setError("Please enter a title, at least one valid slot, and Firebase config.");
      return;
    }

    const slotDocs = usableSlots.map((slot) => ({
      id: slot.id,
      startUtc: toUtcIsoFromLocalInput(slot.localDateTime)
    }));

    try {
      setIsSaving(true);
      const docRef = await addDoc(collection(db, "events"), {
        title: title.trim(),
        timezone: timezone.trim() || "UTC",
        slots: slotDocs,
        createdAt: serverTimestamp()
      });
      navigate(`/event/${docRef.id}`);
    } catch (createError) {
      setError(`Could not create event: ${createError.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <section className="panel">
      <h1>Create Event</h1>
      <p className="muted">
        Add candidate time slots, then share the link so attendees can select all options they can make.
      </p>

      {!firebaseReady && (
        <div className="error-box">
          <strong>Firebase config missing:</strong> {firebaseMissingConfig.join(", ")}
        </div>
      )}

      <form onSubmit={submit} className="form-grid">
        <label>
          Event title
          <input
            type="text"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="Weekly planning"
            required
          />
        </label>

        <label>
          Display timezone
          <input
            type="text"
            value={timezone}
            onChange={(event) => setTimezone(event.target.value)}
            placeholder="America/New_York"
          />
        </label>

        <div className="slot-block">
          <div className="slot-head">
            <h2>Candidate slots</h2>
            <button type="button" className="secondary-btn" onClick={addSlot}>
              Add slot
            </button>
          </div>
          {slots.map((slot, index) => (
            <div key={slot.id} className="slot-row">
              <label>
                Slot {index + 1}
                <input
                  type="datetime-local"
                  value={slot.localDateTime}
                  onChange={(event) => updateSlot(slot.id, event.target.value)}
                />
              </label>
              <button
                type="button"
                className="danger-btn"
                onClick={() => removeSlot(slot.id)}
                disabled={slots.length <= 1}
              >
                Remove
              </button>
            </div>
          ))}
        </div>

        {error && <p className="error-text">{error}</p>}

        <button className="primary-btn" type="submit" disabled={!canCreate}>
          {isSaving ? "Creating..." : "Create and Get Share Link"}
        </button>
      </form>
    </section>
  );
}

export default CreateEventPage;
