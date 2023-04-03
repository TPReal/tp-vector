export interface PatternItem {
  readonly active: boolean;
  readonly length: number;
}

/**
 * Pattern of tabs and/or slots used to connect two layers of cut material,
 * to create 3-dimensional structures.
 */
export class InterlockPattern {

  static readonly EMPTY = InterlockPattern.create();

  protected constructor(readonly items: readonly PatternItem[]) {
  }

  static create() {
    return new InterlockPattern([]);
  }

  first() {
    return this.items.at(0);
  }

  last() {
    return this.items.at(-1);
  }

  /**
   * Adds a section to the pattern. If the section has the same active param as the last one,
   * they are merged. Zero-length sections are ignored. Negative length is an error.
   *
   * The active param is an abstract value, with meaning given by the using class.
   */
  add(active: boolean, length: number) {
    if (length < 0)
      throw new Error(`Expected non-negative length, got: ${length}`);
    if (!length)
      return this;
    const last = this.last();
    return new InterlockPattern(last?.active === active ?
      [...this.items.slice(0, -1), {active, length: last.length + length}] :
      [...this.items, {active, length}],
    );
  }

  addPattern(other: InterlockPattern) {
    let interlock: InterlockPattern = this;
    for (const {active, length} of other.items)
      interlock = interlock.add(active, length);
    return interlock;
  }

  reverse() {
    return new InterlockPattern([...this.items].reverse());
  }

  /** Change active sections to non-active and vice versa. */
  invert() {
    return new InterlockPattern(
      this.items.map(({active, length}) => ({active: !active, length})));
  }

  length() {
    return this.items.reduce((acc, {length}) => acc + length, 0);
  }

  toString() {
    return this.items.map(({active, length}) =>
      active ? `[${length}]` : `${length}`,
    ).join(" ");
  }

}

/** A pattern of tabs at the edge of material. */
export class TabsPattern {

  static readonly EMPTY = TabsPattern.create();

  protected constructor(readonly pattern: InterlockPattern) {
  }

  static create(pattern = InterlockPattern.EMPTY) {
    return new TabsPattern(pattern);
  }

  /**
   * Creates a TabsPattern with the specified number and size of tabs distributed evenly
   * over the specified length.
   */
  static distributed({
    length,
    tabEveryLen,
    minNumTabs = 2,
    numTabs = tabEveryLen ? Math.ceil(length / tabEveryLen) : 0,
    tabToSkipRatio = 1,
    tabLength,
    startWithTab = false,
    endWithTab = false,
  }: {
    length: number,
    tabEveryLen?: number,
    minNumTabs?: number,
    numTabs?: number,
    tabToSkipRatio?: number,
    tabLength?: number,
    startWithTab?: boolean,
    endWithTab?: boolean,
  }) {
    numTabs = Math.floor(Math.max(numTabs, minNumTabs));
    const numSkips = numTabs + 1 - Number(startWithTab) - Number(endWithTab);
    if (numTabs < 0 || numSkips < 0)
      throw new Error(`Bad parameters (numTabs=${numTabs}, numSkips=${numSkips})`);
    let tabLen, skipLen;
    if (tabLength === undefined) {
      const skipUnits = numSkips + numTabs * tabToSkipRatio;
      skipLen = length / skipUnits;
      tabLen = skipLen * tabToSkipRatio;
    } else {
      tabLen = tabLength;
      skipLen = (length - numTabs * tabLen) / numSkips;
    }
    let pattern = TabsPattern.create();
    let first = true;
    while (numTabs--) {
      if (!(first && startWithTab))
        pattern = pattern.base(skipLen);
      first = false;
      pattern = pattern.tab(tabLen);
    }
    if (!endWithTab)
      pattern = pattern.base(skipLen);
    return pattern;
  }

  static tab(tabLength: number) {
    return TabsPattern.EMPTY.tab(tabLength);
  }

  static base(skipLength: number) {
    return TabsPattern.EMPTY.base(skipLength);
  }

  tab(tabLength: number) {
    return TabsPattern.create(this.pattern.add(true, tabLength));
  }

  base(skipLength: number) {
    return TabsPattern.create(this.pattern.add(false, skipLength));
  }

  addPattern(other: TabsPattern) {
    return TabsPattern.create(this.pattern.addPattern(other.pattern));
  }

  reverse() {
    return TabsPattern.create(this.pattern.reverse());
  }

  /** Returns a TabsPattern defining tabs that can be connected with these tabs at some angle. */
  matchingTabs() {
    return TabsPattern.create(this.pattern.invert());
  }

  /** Returns a SlotsPattern defining slots that these tabs can be inserted into. */
  matchingSlots() {
    return SlotsPattern.create(this.pattern);
  }

  length() {
    return this.pattern.length();
  }

  toString() {
    return `TabsPattern[ ${this.pattern} ]`;
  }

}

/** A pattern of slots (holes), going through the material. */
export class SlotsPattern {

  static readonly EMPTY = SlotsPattern.create();

  protected constructor(readonly pattern: InterlockPattern) {
  }

  static create(pattern = InterlockPattern.EMPTY) {
    return new SlotsPattern(pattern);
  }

  /** Creates a slide slot, going from the edge of the material, inside it. */
  static slide(length: number) {
    return SlotsPattern.slot(length).skip(1e-9 * length);
  }

  /**
   * Creates a pair of matching slide slots, each taking half of the specified length.
   * The first pattern starts with a lot, the second start with a skip.
   */
  static slidePair(length: number): [SlotsPattern, SlotsPattern];
  /**
   * Creates a pair of matching slide slots, each taking the specified length.
   * The first pattern starts with a lot, the second start with a skip.
   */
  static slidePair(slot1Length: number, slot2Length: number): [SlotsPattern, SlotsPattern];
  /**
   * Creates a pair of matching slide slots, taking together the specified length.
   * The first pattern starts with a lot, the second start with a skip.
   */
  static slidePair(args: {
    length: number,
    slotLengthsRatio?: number,
    slot1LengthFrac?: number,
  }): [SlotsPattern, SlotsPattern];
  static slidePair(...params: [number] | [number, number] | [{
    length: number,
    slotLengthsRatio?: number,
    slot1LengthFrac?: number,
  }]) {
    let len1, len2;
    if (params.length == 2)
      [len1, len2] = params;
    else {
      const arg = params[0];
      if (typeof arg === "number")
        len1 = len2 = arg / 2;
      else {
        const {
          length,
          slotLengthsRatio = 1,
          slot1LengthFrac = slotLengthsRatio / (slotLengthsRatio + 1),
        } = arg;
        len1 = slot1LengthFrac * length;
        len2 = length - len1;
      }
    }
    const pat1 = InterlockPattern.EMPTY.add(true, len1).add(false, len2);
    return [
      SlotsPattern.create(pat1),
      SlotsPattern.create(pat1.invert()),
    ];
  }

  /**
   * Creates a SlotsPattern with the specified number and size of slots distributed evenly
   * over the specified length.
   */
  static distributed({
    length,
    slotEveryLen,
    minNumSlots,
    numSlots,
    slotToSkipRatio,
    slotLength,
    startWithSlot,
    endWithSlot,
  }: {
    length: number,
    slotEveryLen?: number,
    minNumSlots?: number,
    numSlots?: number,
    slotToSkipRatio?: number,
    slotLength?: number,
    startWithSlot?: boolean,
    endWithSlot?: boolean,
  }) {
    return TabsPattern.distributed({
      length,
      tabEveryLen: slotEveryLen,
      minNumTabs: minNumSlots,
      numTabs: numSlots,
      tabToSkipRatio: slotToSkipRatio,
      tabLength: slotLength,
      startWithTab: startWithSlot,
      endWithTab: endWithSlot,
    }).matchingSlots();
  }

  static slot(slotLength: number) {
    return SlotsPattern.EMPTY.slot(slotLength);
  }

  static skip(skipLength: number) {
    return SlotsPattern.EMPTY.skip(skipLength);
  }

  slot(slotLength: number) {
    return SlotsPattern.create(this.pattern.add(true, slotLength));
  }

  skip(skipLength: number) {
    return SlotsPattern.create(this.pattern.add(false, skipLength));
  }

  addPattern(other: SlotsPattern) {
    return SlotsPattern.create(this.pattern.addPattern(other.pattern));
  }

  reverse() {
    return SlotsPattern.create(this.pattern.reverse());
  }

  /** Returns a TabsPattern defining tabs that can be inserted into these slots. */
  matchingTabs() {
    return TabsPattern.create(this.pattern);
  }

  startsWithSlot() {
    return this.pattern.first()?.active || false;
  }

  endsWithSlot() {
    return this.pattern.last()?.active || false;
  }

  length() {
    return this.pattern.length();
  }

  toString() {
    return `SlotsPattern[ ${this.pattern} ]`;
  }

}
