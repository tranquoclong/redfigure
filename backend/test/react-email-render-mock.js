const { renderToStaticMarkup } = require('react-dom/server');

async function render(element) {
  return renderToStaticMarkup(element);
}

module.exports = { render };
