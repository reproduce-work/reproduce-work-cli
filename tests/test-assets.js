const fs = require('fs');
const path = require('path');
const chai = require('chai');
const expect = chai.expect;

describe('Asset Tests', function() {

    // Array of assets you expect to be present
    const expectedAssets = [
        'static/tex/bibstyle.bst',
        'static/tex/template.tex'
    ];

    expectedAssets.forEach(asset => {
        it(`should have asset: ${asset}`, function(done) {
            const assetPath = path.join(__dirname, '..', asset); // adjust path as needed
            fs.access(assetPath, fs.constants.R_OK, (err) => {
                expect(err).to.be.null;
                done();
            });
        });
    });
});
