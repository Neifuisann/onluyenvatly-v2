// S9-02. Override LHCI_URL for the actual preview; reports stay private.
const urls = (process.env.LHCI_URL || "http://localhost:3009/").split(",");
module.exports = {
  ci: {
    collect: {
      url: urls,
      numberOfRuns: 3,
      settings: {
        formFactor: "mobile",
        screenEmulation: {
          mobile: true,
          width: 360,
          height: 740,
          deviceScaleFactor: 1,
          disabled: false,
        },
        chromeFlags: "--headless --no-sandbox",
        ...(process.env.LHCI_HEADERS_FILE
          ? { extraHeaders: require(process.env.LHCI_HEADERS_FILE) }
          : {}),
      },
    },
    assert: {
      assertions: {
        "categories:performance": [
          "error",
          { minScore: 0.95, aggregationMethod: "median" },
        ],
        "categories:accessibility": [
          "error",
          { minScore: 1, aggregationMethod: "median" },
        ],
        "largest-contentful-paint": [
          "error",
          { maxNumericValue: 1800, aggregationMethod: "median" },
        ],
        "cumulative-layout-shift": [
          "error",
          { maxNumericValue: 0.05, aggregationMethod: "median" },
        ],
      },
    },
    upload: { target: "filesystem", outputDir: "tmp/lighthouse" },
  },
};
