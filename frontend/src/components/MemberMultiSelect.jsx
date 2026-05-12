import { useEffect, useMemo, useRef, useState } from "react";
import api from "../services/api";

const normalizeId = (id) => (id != null ? String(id) : "");

const MemberMultiSelect = ({
  value = [],
  onChange,
  disabled = false,
}) => {
  const [users, setUsers] = useState([]);
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);

  const selectedIds = useMemo(() => value.map(normalizeId), [value]);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const { data } = await api.get("/users");
        if (!cancelled && Array.isArray(data)) {
          setUsers(data.map((u) => ({ _id: normalizeId(u._id), name: u.name, email: u.email })));
        }
      } catch {
        if (!cancelled) setUsers([]);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const handleOutsideClick = (event) => {
      if (rootRef.current && !rootRef.current.contains(event.target)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, []);

  const userById = useMemo(() => {
    const m = new Map();
    users.forEach((u) => m.set(normalizeId(u._id), u));
    return m;
  }, [users]);

  const selectedUsers = useMemo(
    () =>
      selectedIds.map((id) => {
        const u = userById.get(id);
        return u || { _id: id, name: `User`, email: "" };
      }),
    [selectedIds, userById]
  );

  const toggleSelection = (userId) => {
    const nid = normalizeId(userId);
    if (disabled) return;
    if (selectedIds.includes(nid)) {
      onChange(value.filter((id) => normalizeId(id) !== nid));
      return;
    }
    onChange([...value, userId]);
  };

  const removeSelection = (userId) => {
    const nid = normalizeId(userId);
    if (disabled) return;
    onChange(value.filter((id) => normalizeId(id) !== nid));
  };

  return (
    <div ref={rootRef} className="relative w-full">
      {selectedUsers.length > 0 ? (
        <div className="mb-2 flex flex-wrap gap-2">
          {selectedUsers.map((member) => (
            <span
              key={member._id}
              className="bg-purple-500 text-white px-2 py-1 rounded-full flex items-center gap-1 text-xs"
            >
              {member.name}
              <button
                type="button"
                disabled={disabled}
                onClick={() => removeSelection(member._id)}
                className="text-white/90 hover:text-white disabled:opacity-40"
                aria-label="Remove member"
              >
                ×
              </button>
            </span>
          ))}
        </div>
      ) : null}

      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((o) => !o)}
        className="w-full min-w-0 border border-gray-700 bg-gray-900 text-white px-3 py-2 rounded-md text-left text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {!selectedIds.length ? "Select Members" : `${selectedIds.length} selected`}
      </button>

      {open && !disabled && (
        <div className="absolute left-0 right-0 z-20 mt-2 max-h-64 w-full overflow-auto rounded-md bg-gray-800 text-white shadow-lg border border-gray-700 p-1">
          {users.length === 0 ? (
            <p className="px-3 py-2 text-sm text-gray-300">Loading users…</p>
          ) : (
            users.map((user) => {
              const nid = normalizeId(user._id);
              const isSelected = selectedIds.includes(nid);
              return (
                <button
                  key={nid}
                  type="button"
                  onClick={() => toggleSelection(user._id)}
                  className={`mb-1 flex w-full items-start justify-between rounded-md px-3 py-2 text-left text-sm ${
                    isSelected ? "bg-purple-500 text-white" : "text-white hover:bg-gray-700"
                  }`}
                >
                  <span className="min-w-0">
                    <span className="block truncate font-medium">{user.name}</span>
                    <span className={`block truncate text-xs ${isSelected ? "text-white/80" : "text-gray-300"}`}>
                      {user.email}
                    </span>
                  </span>
                </button>
              );
            })
          )}
        </div>
      )}
    </div>
  );
};

export default MemberMultiSelect;
