import { useEffect, useMemo, useRef, useState } from "react";
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

function makeGoogleMapsSearchUrl(placeName) {
  if (!placeName) return "";
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(placeName)}`;
}

function isHalfHourLocalInput(datetimeLocal) {
  if (!datetimeLocal) return false;
  const minuteText = datetimeLocal.split("T")[1]?.split(":")[1];
  return minuteText === "00" || minuteText === "30";
}

function CreateEventPage() {
  const navigate = useNavigate();
  const locationInputRef = useRef(null);
  const [title, setTitle] = useState("");
  const [locationName, setLocationName] = useState("");
  const [locationUrl, setLocationUrl] = useState("");
  const [timezone, setTimezone] = useState(browserTimezone());
  const [durationMinutes, setDurationMinutes] = useState(180);
  const [slots, setSlots] = useState([makeEmptySlot(), makeEmptySlot()]);
  const [error, setError] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    const apiKey = process.env.REACT_APP_GOOGLE_MAPS_API_KEY;
    const input = locationInputRef.current;
    if (!apiKey || !input) return undefined;

    let autocomplete;
    let listener;
    let cancelled = false;

    const setupAutocomplete = () => {
      if (cancelled || !window.google?.maps?.places) return;

      autocomplete = new window.google.maps.places.Autocomplete(input, {
        fields: ["formatted_address", "name", "url"]
      });
      listener = autocomplete.addListener("place_changed", () => {
        const place = autocomplete.getPlace();
        const nextName = place.formatted_address || place.name || input.value;
        setLocationName(nextName);
        setLocationUrl(place.url || makeGoogleMapsSearchUrl(nextName));
      });
    };

    if (window.google?.maps?.places) {
      setupAutocomplete();
    } else {
      const existingScript = document.querySelector("script[data-google-maps-places]");
      if (existingScript) {
        existingScript.addEventListener("load", setupAutocomplete, { once: true });
      } else {
        const script = document.createElement("script");
        script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places`;
        script.async = true;
        script.defer = true;
        script.dataset.googleMapsPlaces = "true";
        script.addEventListener("load", setupAutocomplete, { once: true });
        document.head.appendChild(script);
      }
    }

    return () => {
      cancelled = true;
      if (listener) listener.remove();
      if (autocomplete) window.google?.maps?.event?.clearInstanceListeners(autocomplete);
    };
  }, []);

  const usableSlots = useMemo(
    () =>
      slots.filter(
        (slot) =>
          isHalfHourLocalInput(slot.localDateTime) &&
          Boolean(toUtcIsoFromLocalInput(slot.localDateTime))
      ),
    [slots]
  );

  const hasInvalidSlotTime = slots.some(
    (slot) => slot.localDateTime && !isHalfHourLocalInput(slot.localDateTime)
  );

  const canCreate =
    title.trim().length > 0 &&
    usableSlots.length > 0 &&
    Number(durationMinutes) > 0 &&
    firebaseReady &&
    !isSaving;

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
      setError("Please enter a title, event length, at least one valid slot, and Firebase config.");
      return;
    }

    if (hasInvalidSlotTime) {
      setError("Candidate slots must start exactly on the hour or half hour.");
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
        locationName: locationName.trim(),
        locationUrl: locationUrl.trim(),
        timezone: timezone.trim() || "UTC",
        durationMinutes: Number(durationMinutes),
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

        <div className="two-column">
          <label>
            Location
            <input
              type="text"
              ref={locationInputRef}
              value={locationName}
              onChange={(event) => {
                const nextValue = event.target.value;
                setLocationName(nextValue);
                setLocationUrl((currentUrl) =>
                  currentUrl ? currentUrl : makeGoogleMapsSearchUrl(nextValue)
                );
              }}
              onBlur={() => {
                if (locationName && !locationUrl) {
                  setLocationUrl(makeGoogleMapsSearchUrl(locationName));
                }
              }}
              placeholder={
                process.env.REACT_APP_GOOGLE_MAPS_API_KEY
                  ? "Search Google Maps"
                  : "Main library, Room 204"
              }
            />
          </label>

          <label>
            Directions link
            <input
              type="url"
              value={locationUrl}
              onChange={(event) => setLocationUrl(event.target.value)}
              placeholder="https://maps.google.com/..."
            />
          </label>
        </div>

        <label>
          Event length
          <select
            value={durationMinutes}
            onChange={(event) => setDurationMinutes(event.target.value)}
          >
            <option value={30}>30 minutes</option>
            <option value={60}>1 hour</option>
            <option value={90}>1.5 hours</option>
            <option value={120}>2 hours</option>
            <option value={180}>3 hours</option>
            <option value={240}>4 hours</option>
            <option value={360}>6 hours</option>
          </select>
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
                  step="1800"
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
          {hasInvalidSlotTime && (
            <p className="error-text">Use start times like 1:00 PM or 1:30 PM.</p>
          )}
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
