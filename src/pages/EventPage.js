import { useEffect, useMemo, useState } from "react";
import { addDoc, collection, doc, getDoc, getDocs, serverTimestamp } from "firebase/firestore";
import { useParams } from "react-router-dom";
import { db, firebaseMissingConfig, firebaseReady } from "../firebase";
import { formatUtcForTimezone } from "../utils/time";

function EventPage() {
  const { eventId } = useParams();
  const [eventDoc, setEventDoc] = useState(null);
  const [responses, setResponses] = useState([]);
  const [selectedIds, setSelectedIds] = useState([]);
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [status, setStatus] = useState("loading");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [copyMessage, setCopyMessage] = useState("");

  const loadEvent = async () => {
    if (!firebaseReady) {
      setStatus("error");
      setError(`Firebase config missing: ${firebaseMissingConfig.join(", ")}`);
      return;
    }

    setStatus("loading");
    setError("");
    try {
      const eventRef = doc(db, "events", eventId);
      const eventSnap = await getDoc(eventRef);
      if (!eventSnap.exists()) {
        setStatus("not-found");
        return;
      }

      const value = { id: eventSnap.id, ...eventSnap.data() };
      setEventDoc(value);

      const responsesSnap = await getDocs(collection(db, "events", eventId, "responses"));
      const responseRows = responsesSnap.docs.map((row) => ({ id: row.id, ...row.data() }));
      setResponses(responseRows);

      setStatus("ready");
    } catch (loadError) {
      setError(`Failed to load event: ${loadError.message}`);
      setStatus("error");
    }
  };

  useEffect(() => {
    loadEvent();
  }, [eventId]);

  const toggleSelection = (slotId) => {
    setSelectedIds((prev) =>
      prev.includes(slotId) ? prev.filter((id) => id !== slotId) : [...prev, slotId]
    );
  };

  const submitResponse = async (event) => {
    event.preventDefault();
    if (!firebaseReady || !eventDoc) return;

    if (!name.trim()) {
      setError("Please enter your name.");
      return;
    }
    if (selectedIds.length === 0) {
      setError("Select at least one slot.");
      return;
    }

    setError("");
    setIsSubmitting(true);

    try {
      await addDoc(collection(db, "events", eventId, "responses"), {
        name: name.trim(),
        selectedSlotIds: selectedIds,
        submittedAt: serverTimestamp()
      });
      setName("");
      setSelectedIds([]);
      await loadEvent();
    } catch (submitError) {
      setError(`Failed to submit response: ${submitError.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const shareLink =
    typeof window !== "undefined"
      ? `${window.location.origin}${window.location.pathname}#/event/${eventId}`
      : "";

  const copyShareLink = async () => {
    if (!shareLink) return;
    try {
      await navigator.clipboard.writeText(shareLink);
      setCopyMessage("Link copied.");
      setTimeout(() => setCopyMessage(""), 1800);
    } catch {
      setCopyMessage("Copy failed. Copy manually.");
      setTimeout(() => setCopyMessage(""), 2500);
    }
  };

  const aggregation = useMemo(() => {
    if (!eventDoc) return [];
    const totalParticipants = responses.length;
    const countsBySlot = {};
    const namesBySlot = {};

    for (const slot of eventDoc.slots || []) {
      countsBySlot[slot.id] = 0;
      namesBySlot[slot.id] = [];
    }

    for (const response of responses) {
      const selected = response.selectedSlotIds || [];
      for (const slotId of selected) {
        if (countsBySlot[slotId] === undefined) continue;
        countsBySlot[slotId] += 1;
        namesBySlot[slotId].push(response.name || "Anonymous");
      }
    }

    return (eventDoc.slots || [])
      .map((slot) => ({
        slot,
        count: countsBySlot[slot.id] || 0,
        voters: namesBySlot[slot.id] || [],
        everyoneAvailable: totalParticipants > 0 && (countsBySlot[slot.id] || 0) === totalParticipants
      }))
      .sort((a, b) => b.count - a.count);
  }, [eventDoc, responses]);

  if (status === "loading") return <p>Loading event...</p>;
  if (status === "not-found") return <p>Event not found.</p>;
  if (status === "error") return <p className="error-text">{error}</p>;

  return (
    <section className="panel">
      <h1>{eventDoc.title}</h1>
      <p className="muted">Timezone: {eventDoc.timezone || "UTC"}</p>

      <div className="share-row">
        <input value={shareLink} readOnly />
        <button type="button" className="secondary-btn" onClick={copyShareLink}>
          Copy Link
        </button>
      </div>
      {copyMessage && <p className="muted">{copyMessage}</p>}

      <form onSubmit={submitResponse} className="form-grid">
        <h2>Your availability</h2>
        <label>
          Your name
          <input value={name} onChange={(event) => setName(event.target.value)} placeholder="Alex" />
        </label>

        <div className="slot-choices">
          {(eventDoc.slots || []).map((slot) => (
            <label key={slot.id} className="checkbox-row">
              <input
                type="checkbox"
                checked={selectedIds.includes(slot.id)}
                onChange={() => toggleSelection(slot.id)}
              />
              <span>{formatUtcForTimezone(slot.startUtc, eventDoc.timezone)}</span>
            </label>
          ))}
        </div>

        {error && <p className="error-text">{error}</p>}

        <button type="submit" className="primary-btn" disabled={isSubmitting}>
          {isSubmitting ? "Submitting..." : "Submit Availability"}
        </button>
      </form>

      <section className="results">
        <div className="results-head">
          <h2>Best meeting times</h2>
          <button type="button" className="secondary-btn" onClick={loadEvent}>
            Refresh Results
          </button>
        </div>
        <p className="muted">Participants: {responses.length}</p>
        {aggregation.map((row) => (
          <article key={row.slot.id} className="result-row">
            <div>
              <strong>{formatUtcForTimezone(row.slot.startUtc, eventDoc.timezone)}</strong>
              <p className="muted">{row.voters.length > 0 ? row.voters.join(", ") : "No votes yet"}</p>
            </div>
            <div className="vote-pill">
              {row.count} vote{row.count === 1 ? "" : "s"}
              {row.everyoneAvailable ? " - Everyone can attend" : ""}
            </div>
          </article>
        ))}
      </section>
    </section>
  );
}

export default EventPage;
