const allIds = new Set<string>();

export function registerId(id: string) {
  if (allIds.has(id)) {
    throw new Error(`Id already registered: ${id}`);
  }
  allIds.add(id);
  return id;
}

export function generateId(base = "id") {
  let nextId = 1;
  let id: string;
  do
    id = `__${base}_${nextId++}`;
  while (allIds.has(id));
  return registerId(id);
}
