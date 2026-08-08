/** @type {import('@lhci/cli').LHCI.ServerCommand.Options} */
module.exports = {
  ci: {
    collect: {
      url: [
        "http://fundedbeyond.localhost.test:3000/login",
        "http://fundedbeyond.localhost.test:3000/courses",
        "http://fundedbeyond.localhost.test:3000/p/home",
      ],
      numberOfRuns: 1,
      settings: {
        preset: "desktop",
        onlyCategories: ["performance", "accessibility"],
      },
    },
    assert: {
      assertions: {
        "categories:performance": ["warn", { minScore: 0.75 }],
        "categories:accessibility": ["error", { minScore: 0.9 }],
        "largest-contentful-paint": ["warn", { maxNumericValue: 2500 }],
        "cumulative-layout-shift": ["error", { maxNumericValue: 0.1 }],
      },
    },
    upload: {
      target: "temporary-public-storage",
    },
  },
};
