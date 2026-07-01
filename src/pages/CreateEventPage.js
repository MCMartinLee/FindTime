import { useEffect, useMemo, useRef, useState } from "react";
import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { useNavigate } from "react-router-dom";
import AvailabilityCalendar from "../components/AvailabilityCalendar";
import { db, firebaseMissingConfig, firebaseReady } from "../firebase";
import { browserTimezone, toUtcIsoFromLocalInput } from "../utils/time";

function makeEmptySlot() {
  return {
    id: `${Date.now()}_${Math.random().toString(16).slice(2, 8)}`,
    localDate: "",
    startTime: "09:00"
  };
}

const HALF_HOUR_OPTIONS = Array.from({ length: 48 }, (_, index) => {
  const hour = Math.floor(index / 2);
  const minute = index % 2 === 0 ? "00" : "30";
  const value = `${String(hour).padStart(2, "0")}:${minute}`;
  const displayHour = hour % 12 || 12;
  const suffix = hour < 12 ? "AM" : "PM";

  return {
    value,
    label: `${displayHour}:${minute} ${suffix}`
  };
});

function makeGoogleMapsSearchUrl(placeName) {
  if (!placeName) return "";
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(placeName)}`;
}

function isHalfHourLocalInput(datetimeLocal) {
  if (!datetimeLocal) return false;
  const minuteText = datetimeLocal.split("T")[1]?.split(":")[1];
  return minuteText === "00" || minuteText === "30";
}

function slotToLocalDateTime(slot) {
  if (!slot.localDate || !slot.startTime) return "";
  return `${slot.localDate}T${slot.startTime}`;
}

function CreateEventPage() {
  const navigate = useNavigate();
  const locationInputRef = useRef(null);
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const markerRef = useRef(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [locationName, setLocationName] = useState("");
  const [locationUrl, setLocationUrl] = useState("");
  const [locationLat, setLocationLat] = useState(null);
  const [locationLng, setLocationLng] = useState(null);
  const [timezone, setTimezone] = useState(browserTimezone());
  const [durationMinutes, setDurationMinutes] = useState(180);
  const [slots, setSlots] = useState([makeEmptySlot(), makeEmptySlot()]);
  const [error, setError] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    const apiKey = process.env.REACT_APP_GOOGLE_MAPS_API_KEY;
    const input = locationInputRef.current;
    const mapNode = mapRef.current;
    if (!apiKey || !input || !mapNode) return undefined;

    let autocomplete;
    let listener;
    let mapClickListener;
    let cancelled = false;

    const selectPlace = (place, fallbackName) => {
      const nextName = place.formatted_address || place.name || fallbackName || input.value;
      const placeLocation = place.geometry?.location;
      const lat = placeLocation?.lat();
      const lng = placeLocation?.lng();

      setLocationName(nextName);
      setLocationUrl(place.url || makeGoogleMapsSearchUrl(nextName));
      if (typeof lat === "number" && typeof lng === "number") {
        setLocationLat(lat);
        setLocationLng(lng);
        mapInstanceRef.current.setCenter({ lat, lng });
        mapInstanceRef.current.setZoom(15);
        markerRef.current.setPosition({ lat, lng });
      }
    };

    const setupAutocomplete = () => {
      if (cancelled || !window.google?.maps?.places) return;

      const defaultCenter = { lat: 39.5, lng: -98.35 };
      mapInstanceRef.current = new window.google.maps.Map(mapNode, {
        center: defaultCenter,
        zoom: 4,
        mapTypeControl: false,
        streetViewControl: false,
        fullscreenControl: false
      });
      markerRef.current = new window.google.maps.Marker({
        map: mapInstanceRef.current
      });

      autocomplete = new window.google.maps.places.Autocomplete(input, {
        fields: ["formatted_address", "geometry", "name", "url"]
      });
      listener = autocomplete.addListener("place_changed", () => {
        const place = autocomplete.getPlace();
        selectPlace(place, input.value);
      });

      mapClickListener = mapInstanceRef.current.addListener("click", (mapsEvent) => {
        const lat = mapsEvent.latLng.lat();
        const lng = mapsEvent.latLng.lng();
        const geocoder = new window.google.maps.Geocoder();

        markerRef.current.setPosition({ lat, lng });
        setLocationLat(lat);
        setLocationLng(lng);
        setLocationUrl(`https://www.google.com/maps/search/?api=1&query=${lat},${lng}`);

        geocoder.geocode({ location: { lat, lng } }, (results, status) => {
          if (status === "OK" && results?.[0]) {
            setLocationName(results[0].formatted_address);
          } else {
            setLocationName(`${lat.toFixed(5)}, ${lng.toFixed(5)}`);
          }
        });
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
      if (mapClickListener) mapClickListener.remove();
      if (autocomplete) window.google?.maps?.event?.clearInstanceListeners(autocomplete);
    };
  }, []);

  const usableSlots = useMemo(
    () =>
      slots.filter(
        (slot) =>
          isHalfHourLocalInput(slotToLocalDateTime(slot)) &&
          Boolean(toUtcIsoFromLocalInput(slotToLocalDateTime(slot)))
      ),
    [slots]
  );

  const hasInvalidSlotTime = slots.some(
    (slot) => slot.localDate && slot.startTime && !isHalfHourLocalInput(slotToLocalDateTime(slot))
  );

  const canCreate =
    title.trim().length > 0 &&
    usableSlots.length > 0 &&
    Number(durationMinutes) > 0 &&
    firebaseReady &&
    !isSaving;

  const addSlot = () => setSlots((prev) => [...prev, makeEmptySlot()]);

  const updateSlot = (slotId, values) => {
    setSlots((prev) =>
      prev.map((slot) => (slot.id === slotId ? { ...slot, ...values } : slot))
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
      startUtc: toUtcIsoFromLocalInput(slotToLocalDateTime(slot))
    }));

    try {
      setIsSaving(true);
      const payload = {
        title: title.trim(),
        description: description.trim(),
        locationName: locationName.trim(),
        locationUrl: locationUrl.trim(),
        locationLat,
        locationLng,
        timezone: timezone.trim() || "UTC",
        durationMinutes: Number(durationMinutes),
        slots: slotDocs,
        createdAt: serverTimestamp()
      };
      const docRef = await addDoc(collection(db, "events"), payload);
      navigate(`/event/${docRef.id}`);
    } catch (createError) {
      const permissionHint =
        createError.code === "permission-denied"
          ? " Publish the updated Firestore rules, then try again."
          : "";
      setError(`Could not create event: ${createError.message}.${permissionHint}`);
    } finally {
      setIsSaving(false);
    }
  };

  const previewRows = useMemo(
    () =>
      usableSlots.map((slot) => ({
        slot: {
          id: slot.id,
          startUtc: toUtcIsoFromLocalInput(slotToLocalDateTime(slot))
        },
        count: 0,
        voters: []
      })),
    [usableSlots]
  );

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
          Description
          <textarea
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            placeholder="Add details attendees should know"
            rows={4}
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

        <div className="location-picker">
          <label>
            Search or select location
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
                setLocationLat(null);
                setLocationLng(null);
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

          {process.env.REACT_APP_GOOGLE_MAPS_API_KEY ? (
            <div className="map-picker" ref={mapRef} aria-label="Select event location on map" />
          ) : (
            <div className="map-placeholder">
              Add `REACT_APP_GOOGLE_MAPS_API_KEY` to enable the interactive map picker.
            </div>
          )}

          {locationUrl && (
            <a className="directions-preview" href={locationUrl} target="_blank" rel="noreferrer">
              Preview directions
            </a>
          )}
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
                Date {index + 1}
                <input
                  type="date"
                  value={slot.localDate}
                  onChange={(event) => updateSlot(slot.id, { localDate: event.target.value })}
                />
              </label>
              <label>
                Start time
                <select
                  value={slot.startTime}
                  onChange={(event) => updateSlot(slot.id, { startTime: event.target.value })}
                >
                  {HALF_HOUR_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
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

        <section className="preview-block">
          <h2>Calendar preview</h2>
          <AvailabilityCalendar
            rows={previewRows}
            durationMinutes={Number(durationMinutes)}
            timezone={timezone}
            emptyMessage="Pick a date and start time to preview the event options."
          />
        </section>

        {error && <p className="error-text">{error}</p>}

        <button className="primary-btn" type="submit" disabled={!canCreate}>
          {isSaving ? "Creating..." : "Create and Get Share Link"}
        </button>
      </form>
    </section>
  );
}

export default CreateEventPage;
