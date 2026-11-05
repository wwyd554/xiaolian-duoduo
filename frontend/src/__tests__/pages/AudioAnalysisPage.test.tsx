import React from "react";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import AudioAnalysisPage from "../../pages/AudioAnalysisPage";

test("unavailable audio review offers practice history without mounting upload", () => {
  const fetchMock = jest.fn();
  const previous = global.fetch;
  global.fetch = fetchMock;
  try {
    const { container } = render(<MemoryRouter><AudioAnalysisPage /></MemoryRouter>);
    expect(screen.getByRole("alert")).toHaveTextContent("录音复盘暂未开放");
    expect(screen.getByRole("link", { name: "查看陪练复盘" })).toHaveAttribute("href", "/history");
    expect(screen.getByRole("link", { name: "开始练习" })).toHaveAttribute("href", "/scenarios");
    expect(container.querySelector('input[type="file"]')).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  } finally {
    global.fetch = previous;
  }
});
