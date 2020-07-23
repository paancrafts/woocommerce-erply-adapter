const WooCommerceRestApi = require("@woocommerce/woocommerce-rest-api").default;
const { 
  verifyErplyUser,
  getPaymentTypes,
  getErplyProducts,
  getOnlyChangedErplyProducts,
  getErplyStockData,
  getErplyBrands,
  getPriceLists,
  getProductPricesInPriceLists,
  saveCustomer,
  getCustomers,
  erplyWooCommerceCategoriesSync,
  erplyWooCommerceBrandsSync,
  sendOrderToErply
} = require('./Erply');

const woocommRestApi = new WooCommerceRestApi({
  url: process.env.WC_URL,
  consumerKey: process.env.WC_CONSUMER_KEY,
  consumerSecret: process.env.WC_CONSUMER_SECRET,
  version: "wc/v3"
});

//WooCommerce product import
function wooCommerceProductImport(
  erplyMainProducts, 
  activeErplyVariations, 
  wcAttrsWithTerms, 
  wcCats, 
  wcSizes,
  wcColors,
  wcBrands) {
  function removeDuplicateProducts(a, b) {
    for (var i = 0, len = a.length; i < len; i++) { 
      for (var j = 0, len2 = b.length; j < len2; j++) { 
          if (a[i].sku === b[j].sku) {
              b.splice(j, 1);
              len2=b.length;
          }
      }
    }
    return b;
  }
  function fetchWCProducts() {
    WooCommerce.get('products')
    .then((response) => {  
      const totalOfProductPages = Number(response.headers['x-wp-totalpages']);
      const wooProducts = response.data;
      if (totalOfProductPages > 1) {
        let getRemainingProductsFromWCPromise = [];
        let pageCount = 1;
        for (let i = 0; i < totalOfProductPages; i++) {
          ++pageCount
          getRemainingProductsFromWCPromise.push(new Promise((resolve, reject) => {
            WooCommerce.get('products', {
              page: pageCount,
            })
            .then((response) => {
              function handleResponse() {
                return response
              }
              resolve(handleResponse())
            })
            .catch(error => {
              console.log({
                status: error.response.status,
                statusText: error.response.statusText,
                code: error.response.data.code,
                message: error.response.data.message,
                data: error.response.data.data
              });
              reject(error)
            })
          }));
        }
        return Promise.all(getRemainingProductsFromWCPromise)
        .then((responses) => {
          responses.forEach((item) => {
            wooProducts.push(...item.data);
          });
        })
        .then(() => {
          let erplyRootProductsToCreate = [];
          erplyMainProducts.map((product) => {
            let matrixProductSizeOptions = [];
            let matrixProductColorOptions = [];
            product.productVariations.map((variation) => {
              activeErplyVariations.find((product) => {
                if (variation == product.productID && product.active === 1) {
                  const variationDesc = product.variationDescription;
                  for (let i = 0; i < wcAttrsWithTerms.length; i++) {
                    for (let j = 0; j < variationDesc.length; j++) {
                      if (variationDesc[j].name === 'Size' && !matrixProductSizeOptions.includes(variationDesc[j].value)) {
                        matrixProductSizeOptions.push(variationDesc[j].value)
                      }
                      if (variationDesc[j].name === 'Color') {
                        matrixProductColorOptions.push(variationDesc[j].value)
                      }
                    }
                  }
                }
              });
            });
            let categoriesToAdd = [
              { id: 131 },
            ];
            for (let i = 0; i < wcCats.length; i++) {
              if (wcCats[i].name === product.groupName) {
                categoriesToAdd.push({
                  id: wcCats[i].id
                });
              }
            }
            erplyRootProductsToCreate.push({
              name: product.name.trim(),
              description: product.longdesc,
              short_description: product.description,
              type: 'variable',
              regular_price: product.priceWithVat.toString(),
              sku: product.code.replace(/\s/g, ''),
              categories: categoriesToAdd,
              attributes: [
                {
                  id: wcSizes[0].id,
                  name: 'Suurus',
                  visible: true,
                  variation: true,
                  options: matrixProductSizeOptions,
                },
                {
                  id: wcColors[0].id,
                  name: 'Värv',
                  visible: true,
                  variation: true,
                  options: matrixProductColorOptions,
                },
                {
                  id: wcBrands[0].id,
                  name: 'Bränd',
                  options: [product.brandName],
                },
              ],
              images: product.images.map((img) => {
                return {
                  src: img.fullURL || null,
                  alt: img.name.trim() || null,
                  name: img.name.trim() || null,
                }
              }),
              meta_data: [
                {
                  key: 'erply_id',
                  value: product.productID,
                }
              ],
            });
          });
          removeDuplicateProducts(wooProducts, erplyRootProductsToCreate)
          return erplyRootProductsToCreate
        })
        .then((data) => {
          const missingWCProducts = data;
          if (missingWCProducts.length === 0) {
          } else {
            WooCommerce.post('products/batch', {
              create: missingWCProducts
            })
            .then((response) => {
              let erplyVariationIds = [];
              response.data.create.map((item) => {
                for (let i = 0; i < erplyMainProducts.length; i++) {
                  if (erplyMainProducts[i].code.replace(/\s/g, '').includes(item.sku)) {
                    erplyVariationIds.push({ 
                      wcParentId: item.id, 
                      variationErplyIds: erplyMainProducts[i].productVariations, 
                    });
                  }
                }
              });
              let erplyVariationsToSaveToWc = [];
              erplyVariationIds.map((variation) => {
                for (let i = 0; i < activeErplyVariations.length; i++) {
                  for (let j = 0; j < variation.variationErplyIds.length; j++) {
                    if (activeErplyVariations[i].productID.toString() === variation.variationErplyIds[j] && activeErplyVariations[i].active) {
                      erplyVariationsToSaveToWc.push({
                        wcParentId: variation.wcParentId,
                        erplyVariation: activeErplyVariations[i]
                      });
                    }
                  }
                }
              });              
              erplyVariationsToSaveToWc.forEach((product) => {
                let variationAttributes = [];
                const variationDescription = product.erplyVariation.variationDescription;
                for (let i = 0;  i < variationDescription.length; i++) {
                  wcAttrsWithTerms.forEach((attr) => {
                    if (variationDescription[i].name === 'Size' && attr.attribute.name === 'Suurus') {
                      variationAttributes.push({
                        id: attr.attribute.id,
                        option: variationDescription[i].value,
                      })
                    }
                    if (variationDescription[i].name === 'Color' && attr.attribute.name === 'Värv') {
                      variationAttributes.push({
                        id: attr.attribute.id,
                        option: variationDescription[i].value,
                      })
                    }
                  })
                }
                WooCommerce.post(`products/${product.wcParentId}/variations`, {
                  description: '',
                  short_description: '',
                  name: product.erplyVariation.name,
                  sku: product.erplyVariation.code.replace(/\s/g, ''),
                  manage_stock: true,
                  attributes: variationAttributes,
                  meta_data: [
                    {
                      key: 'erply_id',
                      value: product.erplyVariation.productID,
                    }
                  ],
                  regular_price: product.erplyVariation.priceWithVat.toString(),
                  stock_quantity: Number(product.erplyVariation.warehouses['1'].totalInStock),
                  sale_price: product.erplyVariation.priceListPriceWithVat.toString()
                })
                .then((response) => {
                  console.log(response.data.id + ' ' + response.data.sku + ' product variation added');
                })
                .catch((error) => {
                  console.log({
                    status: error.response.status,
                    statusText: error.response.statusText,
                    code: error.response.data.code,
                    message: error.response.data.message,
                    data: error.response.data.data
                  });
                });
              })
            })
            .catch(error => console.log({
              status: error.response.status,
              statusText: error.response.statusText,
              code: error.response.data.code,
              message: error.response.data.message,
              data: error.response.data.data
            }))
          }
        })
        .catch(err => console.log(err))
      }
    })
    .catch(error => console.log({
      status: error.response.status,
      statusText: error.response.statusText,
      code: error.response.data.code,
      message: error.response.data.message,
      data: error.response.data.data
    }))
  }
  fetchWCProducts()
}
// WooCommerce products update
function wooCommerceUpdate (
  wcProductData, 
  activeErplyMainProducts, 
  activeErplyVariations, 
  wcAttrsWithTerms, 
  wcCats, 
  wcSizes,
  wcColors,
  wcBrands) {
  let priceListStartGMT = '';
  let priceListEndGMT = '';
  function getPricelistsDataFromErply() {
    let pricelistDataPromise = new Promise((resolve, reject) => {
      getPriceLists()
      .then((data) => {
        data.records.filter((record) => {
          let dateCheck = new Date();
          const dateFrom = record.startDate;
          const dateTo = record.endDate;
          const dd = String(dateCheck.getDate()).padStart(2, '0');
          const mm = String(dateCheck.getMonth() + 1).padStart(2, '0'); //January is 0!
          const yyyy = dateCheck.getFullYear();
          const hrs = dateCheck.getHours();
          const mins = dateCheck.getMinutes();
          const secs = dateCheck.getSeconds();
          dateCheck = yyyy + '-' + mm + '-' + dd;
          const d1 = dateFrom.split("-");
          const t1 = ('00:00:00').split(':');
          const d2 = dateTo.split("-");
          const t2 = ('23:59:59').split(':');
          const c = dateCheck.split("-");
          const from = new Date(d1[0], parseInt(d1[1])-1, d1[2], t1[0] - 1, t1[1], t1[2]);  // -1 because months are from 0 to 11
          const to   = new Date(d2[0], parseInt(d2[1])-1, d2[2], t2[0] - 1, t2[1], t2[2]);
          const check = new Date(c[0], parseInt(c[1])-1, c[2], hrs, mins, secs);
          if (check > from && check < to) {
            console.log('Got pricelist: ' + record.name);
            priceListStartGMT = from.toUTCString();
            priceListEndGMT = to.toUTCString();
            resolve(record);
          } 
        });
      })
      .catch(error => {
        console.log('Stock/Price Update Get Erply Pricelist Error: ', error);
        reject(error);
      });
    });
    return Promise.resolve(pricelistDataPromise)
  }
  getPricelistsDataFromErply()
  .then((priceListData) => {
    const priceListRules = priceListData.pricelistRules;
    let pricesWithStock = [];
    priceListRules.forEach((rule) => {
      pricesWithStock.push({
        erply_id: rule.id,
        date_on_sale_from_gmt: priceListStartGMT,
        date_on_sale_to_gmt: priceListEndGMT,
        sale_price: rule.priceWithVat,
        stock_quantity: '',
      })
    });
    async function getErplyStockData () {
      const getProductStockParams = new URLSearchParams();
      getProductStockParams.append('clientCode', process.env.ERPLY_CC);
      getProductStockParams.append('sessionKey', sessionKey);
      getProductStockParams.append('request', 'getProductStock');
      getProductStockParams.append('sendContentType', 1);
      let response = await fetch(ERPLY_URL, { method: 'POST', body: getProductStockParams });
      let data = await response.json();
      return data;
    }
    getErplyStockData()
    .then(stockData => {
      const erplyStockData = stockData.records;
      pricesWithStock.forEach(item => {
        for (let i = 0; i < erplyStockData.length; i++) {
          if (item.erply_id === erplyStockData[i].productID) {
            item.stock_quantity = erplyStockData[i].amountInStock;
          }
        }
      });
      const wcMatrixProductsWithErplyIds = wcProductData.map((product) => {
        for (let i = 0; i < product.meta_data.length; i++) {
          if (product.meta_data[i].key === 'erply_id') {
            return {
              id: product.id,
              erply_id: product.meta_data[i].value,
              sku: product.sku,
              variations: product.variations,
              attributes: product.attributes
            }
          }
        }
      });
      console.log('Active Erply matrix products: ' + activeErplyMainProducts.length)
      console.log('Active Erply variations: ' + activeErplyVariations.length)
      activeErplyMainProducts.map((product) => {
        let matrixProductSizeOptions = [];
        let matrixProductColorOptions = [];
        product.productVariations.map((variation) => {
          activeErplyVariations.find((product) => {
            if (variation == product.productID && product.displayedInWebshop === 1) {
              const variationDesc = product.variationDescription;
              for (let i = 0; i < wcAttrsWithTerms.length; i++) {
                for (let j = 0; j < variationDesc.length; j++) {
                  if (variationDesc[j].name === 'Size' && !matrixProductSizeOptions.includes(variationDesc[j].value)) {
                    matrixProductSizeOptions.push(variationDesc[j].value)
                  }
                  if (variationDesc[j].name === 'Color') {
                    matrixProductColorOptions.push(variationDesc[j].value)
                  }
                }
              }
            }
          });
        });
        for (let i = 0; i < wcMatrixProductsWithErplyIds.length; i++) {
          let categoriesToAdd = [
            { id: 131 },
          ];
          for (let i = 0; i < wcCats.length; i++) {
            if (wcCats[i].name === product.groupName) {
              categoriesToAdd.push({
                id: wcCats[i].id,
              });
            }
          }
          if (product.productID == wcMatrixProductsWithErplyIds[i].erply_id) {
            WooCommerce.put(`products/${wcMatrixProductsWithErplyIds[i].id}`, {
              name: product.name.trim(),
              description: product.longdesc,
              short_description: product.description,
              type: 'variable',
              sku: product.code.replace(/\s/g, ''),
              weight: product.grossWeight,
              manage_stock: false,
              categories: categoriesToAdd,
              meta_data: [
                {
                  key: 'erply_id',
                  value: product.productID,
                }
              ],
              attributes: [
                {
                  id: wcSizes[0].id,
                  name: 'Suurus',
                  visible: true,
                  variation: true,
                  options: matrixProductSizeOptions,
                },
                {
                  id: wcColors[0].id,
                  name: 'Värv',
                  visible: true,
                  variation: true,
                  options: matrixProductColorOptions,
                },
                {
                  id: wcBrands[0].id,
                  name: 'Bränd',
                  options: [product.brandName],
                },
              ]
            })
            .then((response) => {
              const parentProductID = response.data.id;
              WooCommerce.get(`products/${parentProductID}/variations`)
              .then((response) => {
                const wcVariations = response.data;
                // console.log(response.data)
                wcVariations.map(item => {
                  const erplyID = item.meta_data.find(product => product.key === 'erply_id');
                  activeErplyVariations.forEach((erplyActiveVariation) => {
                    if (erplyActiveVariation.productID.toString() === erplyID.value) {
                      let productPriceListPricesAndStock = {};
                      let priceWithStockCounter = 0;
                      for (let i = 0; i < pricesWithStock.length; i++) {
                        ++priceWithStockCounter;
                        if (pricesWithStock[i].erply_id.toString() === erplyID.value) {
                          productPriceListPricesAndStock = pricesWithStock[i];
                        }
                      }
                      if (priceWithStockCounter === pricesWithStock.length) {
                        const date_on_sale_from_gmt_for_update = () => {
                          if (productPriceListPricesAndStock.date_on_sale_from_gmt) {
                            return productPriceListPricesAndStock.date_on_sale_from_gmt
                          } else { return null }
                        }
                        const date_on_sale_to_gmt_for_update = () => {
                          if (productPriceListPricesAndStock.date_on_sale_to_gmt) {
                            return productPriceListPricesAndStock.date_on_sale_to_gmt
                          } else { return null }
                        }
                        const sale_price_for_update = () => {
                          if (productPriceListPricesAndStock.sale_price) {
                            return productPriceListPricesAndStock.sale_price.toString()
                          } else { return null }
                        }
                        const variation_status = () => {
                          if (Number(erplyActiveVariation.warehouses['1'].totalInStock) <= 0) {
                            return 'private'
                          } else { return 'publish' }
                        }
                        WooCommerce.put(`products/${parentProductID}/variations/${item.id}`, {
                          description: '',
                          short_description: '',
                          name: erplyActiveVariation.name,
                          sku: erplyActiveVariation.code.replace(/\s/g, ''),
                          manage_stock: true,
                          status: variation_status(),
                          meta_data: [
                            {
                              key: 'erply_id',
                              value: erplyActiveVariation.productID,
                            }
                          ],
                          regular_price: erplyActiveVariation.priceWithVat.toString(),
                          stock_quantity: Number(erplyActiveVariation.warehouses['1'].totalInStock),
                          date_on_sale_from_gmt: date_on_sale_from_gmt_for_update(),
                          date_on_sale_to_gmt: date_on_sale_to_gmt_for_update(),
                          sale_price: sale_price_for_update()
                        })
                        .then(() => {})
                        .catch((error) => {
                          console.log({
                            status: error.response.status,
                            statusText: error.response.statusText,
                            code: error.response.data.code,
                            message: error.response.data.message,
                            data: error.response.data.data
                          });
                        });
                      }
                    }
                  });
                })
              })
              .catch(error => console.log(error))
            })
            .catch((error) => {
              console.log({
                status: error.response.status,
                statusText: error.response.statusText,
                code: error.response.data.code,
                message: error.response.data.message,
                data: error.response.data.data
              });
            });
          }
        }
      })
    })
    .catch(err => console.log(err))
  })
  .catch(err => console.log(err))
}
// Sync products promise
function erplyWooCommerceProductsSync(savedUnixTime) {
  let productsSyncPromise = new Promise((resolve, reject) => {
    let wcAttributesWithTerms = [];
    WooCommerce.get("products/categories", {per_page: 100})
    .then((wcCategories) => {
      const wooCommerceCategories = wcCategories.data;
      WooCommerce.get('products/attributes', {per_page: 100})
      .then((wcAttributes) => {
        const wooCommerceAttributes = wcAttributes.data;
        const wcSizeAttribute = wooCommerceAttributes.filter((attr) => { return attr.name === 'Suurus'});
        const wcColorAttribute = wooCommerceAttributes.filter((attr) => { return attr.name === 'Värv'});
        const wcBrandAttribute = wooCommerceAttributes.filter((attr) => { return attr.name === 'Bränd'});
        function prepareAttributesWithTerms(callback) {
          let attributeCounter = 0;
          for (let i = 0; i < wooCommerceAttributes.length; i++) {
            WooCommerce.get(`products/attributes/${wooCommerceAttributes[i].id}/terms`, {per_page: 100})
            .then((wooCommerceAttributeTermsResponse) => {
              ++attributeCounter;
              const wooCommerceAttributeTerms = wooCommerceAttributeTermsResponse.data;
              wcAttributesWithTerms.push({
                attribute: wooCommerceAttributes[i],
                terms: wooCommerceAttributeTerms
              });
              if (attributeCounter === wooCommerceAttributes.length) {
                // console.log('WooCommerce attributes with terms stored in buffer');
                callback();
              } 
            })
            .catch(error => console.log({
              status: error.response.status,
              statusText: error.response.statusText,
              code: error.response.data.code,
              message: error.response.data.message,
              data: error.response.data.data
            }));
          }
        }
        let erplyProductsObject = null;
        let wooCommProducts = null;
        let allProducts = [];
        let activeMatrixProducts = [];
        let archivedMatrixProducts = [];
        let activeVariations = [];
        let archivedVariations = [];
        let allProductsObj = null;
        let pagesLeftToFetch = 0;
        function getAllErplyProducts() {
          async function fetchAllErplyProducts (pageNo) {
            // console.log(pageNo, 'page fetch started')
            const getProductsParams = new URLSearchParams();
            getProductsParams.append('clientCode', process.env.ERPLY_CC);
            getProductsParams.append('sessionKey', sessionKey);
            getProductsParams.append('request', 'getProducts');
            // getProductsParams.append('groupID', 1);
            getProductsParams.append('recordsOnPage', 100);
            getProductsParams.append('pageNo', pageNo);
            getProductsParams.append('getMatrixVariations', 1);
            getProductsParams.append('getStockInfo', 1);
            getProductsParams.append('getPriceListPrices', 1);
            getProductsParams.append('sendContentType', 1);
            let response = await fetch(ERPLY_URL, { method: 'POST', body: getProductsParams });
            let data = await response.json();
            return data;
          }
          let getErplyProductsPromise = new Promise((resolve, reject) => {
            // Get product groups from Erply
            fetchAllErplyProducts(1)
            .then(erplyResponse => {
              pagesLeftToFetch = Number((erplyResponse.status.recordsTotal / 100).toString().split('.')[0]); 
              const erplyProducts = erplyResponse.records;
              for (let i = 0; i < erplyProducts.length; i++) {
                if (erplyProducts[i].type === 'MATRIX' || erplyProducts[i].type === 'PRODUCT' ) {
                  allProducts.push(erplyProducts[i]);
                }
                if (erplyProducts[i].type === 'MATRIX' && erplyProducts[i].displayedInWebshop === 1 && erplyProducts[i].active === 1) {
                  activeMatrixProducts.push(erplyProducts[i]);
                }
                if (erplyProducts[i].type === 'PRODUCT' && erplyProducts[i].displayedInWebshop === 1 && erplyProducts[i].active === 1) {
                  activeVariations.push(erplyProducts[i]);
                }
                if (erplyProducts[i].type === 'MATRIX' && erplyProducts[i].displayedInWebshop === 0) {
                  archivedMatrixProducts.push(erplyProducts[i]);
                }
                if (erplyProducts[i].type === 'PRODUCT' && erplyProducts[i].displayedInWebshop === 0) {
                  archivedVariations.push(erplyProducts[i]);
                }
              }
            })
            .then(() => {
              let getProductsFromAllPagesPromise = [];
              let i = 0;
              function fetchErplyProductsLoop () {
                setTimeout(function () {
                  getProductsFromAllPagesPromise.push(new Promise((resolve, reject) => {
                    fetchAllErplyProducts(i + 2)
                    .then(erplyResponse => {
                      const erplyProducts = erplyResponse.records;
                      function saveProductsDataToBuffer() {
                        for (let j = 0; j < erplyProducts.length; j++) {
                          if (erplyProducts[j].type === 'MATRIX' || erplyProducts[j].type === 'PRODUCT') {
                            allProducts.push(erplyProducts[j]);
                          }
                          if (erplyProducts[j].type === 'MATRIX' && erplyProducts[j].displayedInWebshop === 1 && erplyProducts[j].active === 1) {
                            activeMatrixProducts.push(erplyProducts[j]);
                          }
                          if (erplyProducts[j].type === 'PRODUCT' && erplyProducts[j].displayedInWebshop === 1 && erplyProducts[j].active === 1) {
                            activeVariations.push(erplyProducts[j]);
                          }
                          if (erplyProducts[j].type === 'MATRIX' && erplyProducts[j].displayedInWebshop === 0) {
                            archivedMatrixProducts.push(erplyProducts[j]);
                          }
                          if (erplyProducts[j].type === 'PRODUCT' && erplyProducts[j].displayedInWebshop === 0) {
                            archivedVariations.push(erplyProducts[j]);
                          }
                        }
                      }
                      resolve(saveProductsDataToBuffer())
                    }).catch(err => {
                      console.log(err)
                      reject(err)
                    });
                    i++;
                  }))
                  if (i < pagesLeftToFetch) {
                    fetchErplyProductsLoop();
                  }
                }, 75)
              }       
              fetchErplyProductsLoop();   
              return Promise.all(getProductsFromAllPagesPromise)
            })
            .then(() => {
              allProductsObj = {
                allProducts: allProducts,
                activeProducts: {
                  matrix: activeMatrixProducts,
                  variations: activeVariations,
                },
                archivedProducts: {
                  matrix: archivedMatrixProducts,
                  variations: archivedVariations,
                },
              };
              erplyProductsObject = allProductsObj;
              wooCommerceProductImport(
                activeMatrixProducts, 
                activeVariations, 
                wcAttributesWithTerms, 
                wooCommerceCategories,
                wcSizeAttribute,
                wcColorAttribute,
                wcBrandAttribute)
            })
            .then(() => {
              syncAllWooCommProducts()
              .then(() => {})
              .catch(err => console.log(err));
            })
            .catch((err) => {
              console.log(err);
            });
          });
          return Promise.resolve(getErplyProductsPromise);
        }
        prepareAttributesWithTerms(getAllErplyProducts)
        let matrixProductsToRemoveFromWc = [];
        function syncAllWooCommProducts() {
          let syncAllWooCommProductsPromise = new Promise((resolve, reject) => {
            WooCommerce.get('products')
            .then((response) => {
              console.log('Erply products total: ' + allProducts.length)
              console.log('Active Erply matrix products: ' + activeMatrixProducts.length)
              console.log('Active Erply variations: ' + activeVariations.length)
              console.log('Archived Erply matrix products: ' + archivedMatrixProducts.length)
              console.log('Archived Erply variations: ' + archivedVariations.length)
              console.log('WooCommerce product pages:', Number(response.headers['x-wp-totalpages']));
              console.log('WooCommerce products:', response.headers['x-wp-total']);
              const totalOfProductPages = Number(response.headers['x-wp-totalpages']);
              wooCommProducts = response.data;
              if (totalOfProductPages > 1) {
                let getRemainingProductsFromWCPromise = [];
                let pageCount = 1;
                for (let i = 0; i < totalOfProductPages; i++) {
                  ++pageCount
                  getRemainingProductsFromWCPromise.push(new Promise((resolve, reject) => {
                    WooCommerce.get('products', {
                      page: pageCount,
                    })
                    .then((response) => {
                      function handleResponse() {
                        return response
                      }
                      resolve(handleResponse())
                    }).catch(error => {
                      console.log(error);
                      reject(error)
                    });
                  }))
                }
                Promise.all(getRemainingProductsFromWCPromise)
                .then((responses) => {
                  responses.forEach((item) => {
                    wooCommProducts.push(...item.data);
                  });
                })
                .then(() => {
                  matrixProductsToRemoveFromWc = wooCommProducts.filter((item) => {
                    const hiddenMatrixProducts = erplyProductsObject.archivedProducts.matrix;
                    for (let i = 0; i < hiddenMatrixProducts.length; i++) {
                      if (item.sku == hiddenMatrixProducts[i].code.replace(/\s/g, '')) {
                        return item
                      }
                    }
                  });
                  wooCommProducts.map(matrix => {
                    WooCommerce.get(`products/${matrix.id}/variations`)
                    .then((response) => {
                      const wcVariableProducts = response.data;
                      const variableProductsToRemoveFromWc = wcVariableProducts.filter((item) => {
                        const hiddenVariableProducts = erplyProductsObject.archivedProducts.variations;
                        for (let i = 0; i < hiddenVariableProducts.length; i++) {
                          if (item.sku === hiddenVariableProducts[i].code.replace(/\s/g, '')) {
                            return item
                          }
                        }
                      });
                      if (variableProductsToRemoveFromWc.length > 0) {
                        for (let i = 0; i < variableProductsToRemoveFromWc.length; i++) {
                          WooCommerce.delete(`products/${matrix.id}/variations/${variableProductsToRemoveFromWc[i].id}`, {
                            force: true
                          })
                          .then((response) => {
                            console.log('Removed ' + response.data.sku + ' from WooCommerce');
                          })
                          .catch(error => console.log({
                            status: error.response.status,
                            statusText: error.response.statusText,
                            code: error.response.data.code,
                            message: error.response.data.message,
                            data: error.response.data.data
                          }))
                        }
                      } 
                    })
                    .catch((error) => {
                      console.log({
                        status: error.response.status,
                        statusText: error.response.statusText,
                        code: error.response.data.code,
                        message: error.response.data.message,
                        data: error.response.data.data
                      })
                    });
                  });
                })
                .then(() => {
                  if (matrixProductsToRemoveFromWc.length > 0) {
                    for (let i = 0; i < matrixProductsToRemoveFromWc.length; i++) {
                      WooCommerce.delete(`products/${matrixProductsToRemoveFromWc[i].id}`, {
                        force: true
                      })
                      .then((response) => {
                        console.log(matrixProductsToRemoveFromWc[i].sku + ' ' + matrixProductsToRemoveFromWc[i].name + ' deleted')
                      })
                      .catch((error) => {
                        console.log({
                          status: error.response.status,
                          statusText: error.response.statusText,
                          code: error.response.data.code,
                          message: error.response.data.message,
                          data: error.response.data.data
                        });
                      });
                    }
                  } 
                })
                .then(() => {
                  wooCommerceUpdate(
                    wooCommProducts, 
                    activeMatrixProducts, 
                    activeVariations, 
                    wcAttributesWithTerms, 
                    wooCommerceCategories,
                    wcSizeAttribute,
                    wcColorAttribute,
                    wcBrandAttribute
                  );
                })
                .catch(err => console.log(err))
              } else {
                wooCommerceUpdate(
                  wooCommProducts, 
                  activeMatrixProducts, 
                  activeVariations, 
                  wcAttributesWithTerms, 
                  wooCommerceCategories,
                  wcSizeAttribute,
                  wcColorAttribute,
                  wcBrandAttribute
                );
              }
            })
            .catch(error => console.log({
              status: error.response.status,
              statusText: error.response.statusText,
              code: error.response.data.code,
              message: error.response.data.message,
              data: error.response.data.data
            }));
          });
          return Promise.resolve(syncAllWooCommProductsPromise);
        }
      })
      .catch(error => console.log({
        status: error.response.status,
        statusText: error.response.statusText,
        code: error.response.data.code,
        message: error.response.data.message,
        data: error.response.data.data
      }));
    })
    .catch(error => console.log({
      status: error.response.status,
      statusText: error.response.statusText,
      code: error.response.data.code,
      message: error.response.data.message,
      data: error.response.data.data
    }));
  });
  return Promise.resolve(productsSyncPromise);
}
module.exports = {
  woocommRestApi,
  erplyWooCommerceProductsSync,
  wooCommerceProductImport,
  wooCommerceUpdate
};