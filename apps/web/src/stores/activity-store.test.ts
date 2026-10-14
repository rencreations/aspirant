import { activityStore, logActivity } from "./activity-store";

describe("activity store", () => {
  beforeEach(() => activityStore.setState(() => []));

  it("prepends entries and caps the log at six", () => {
    for (let i = 0; i < 8; i++) logActivity(`event ${i}`);
    const state = activityStore.state;
    expect(state).toHaveLength(6);
    expect(state[0]?.message).toBe("event 7");
  });
});
