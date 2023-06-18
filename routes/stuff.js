import { MyResponse } from "../Response.js";
import { Router } from "../Router.js";
import { html } from "../html.js";
import { documentLayout } from "../layout.js";

export const router = new Router();

router.get("/stuff.html", async () => {
  return new MyResponse().html(
    documentLayout({
      main: html`
        <details>
          <summary>iRobot Roomba 675 <strong>Robot Vacuum</strong></summary>
          <ul>
            <li>
              <a href="https://www.amazon.com/dp/B07DL4QY5V/"
                >Amazon Product Page</a
              >
            </li>
            <li>
              <a
                href="https://store.irobot.com/default/roomba-vacuuming-robot-vacuum-irobot-roomba-675/R675020.html"
                >iRobot Product Page</a
              >
            </li>
            <li>
              <a
                href="https://homesupport.irobot.com/euf/assets/images/faqs/roomba/600/legacy/manual/en-US.pdf"
                >User guide</a
              >
              (<a href="/files/roomba675manual.pdf">archived</a>)
            </li>
          </ul>
        </details>

        <details>
          <summary>GE <strong>Dishwasher</strong></summary>
          <ul>
            <li>Model #: GTD635HSM0SS (on interior), GDT635HSMSS (online)</li>
            <li>
              <a
                href="https://www.geappliances.com/appliance/GE-Top-Control-with-Stainless-Steel-Interior-Door-Dishwasher-with-Sanitize-Cycle-Dry-Boost-GDT635HSMSS"
                >GE Product Page</a
              >
            </li>
            <li>
              <a
                href="https://products.geappliances.com/MarketingObjectRetrieval/Dispatcher?RequestType=PDF&Name=49-55122-4.PDF"
                >Owner's Manual</a
              >
              (<a href="/files/20210302-ge-dishwasher-owners-manual.pdf"
                >archived</a
              >)
            </li>
            <li>
              <a
                href="https://products.geappliances.com/MarketingObjectRetrieval/Dispatcher?RequestType=PDF&Name=U506600021300.pdf"
                >Energy Guide</a
              >
              (<a href="/files/20210302-ge-dishwasher-energy-guide.pdf"
                >archived</a
              >)
            </li>
          </ul>
        </details>

        <details>
          <summary>GE PSA9240 <strong>Microwave</strong></summary>
          <ul>
            <li>Model: PSA9240SF5SS</li>
            <li>Serial: GM300081L</li>
            <li>Rated wattage: 975 W</li>
            <li>
              <a
                href="https://www.geappliances.com/appliance/GE-Profile-Over-the-Range-Oven-with-Advantium-Technology-PSA9240SFSS"
                >Product Page</a
              >
            </li>
            <li>
              <a
                href="https://ge.appliancesaccount.io/MyAccount/MOBILEREGISTERVALIDATE?K=PSA9240SFSS&M=PSA9240SF5SS&S=GM300081L&P=R"
                >Service Page</a
              >
            </li>
            <li>
              <a
                href="https://products.geappliances.com/MarketingObjectRetrieval/Dispatcher?RequestType=PDF&Name=49-40678-4.PDF&_ga=2.259958410.1602249701.1614748618-878360029.1614748618"
                >Owner's Manual</a
              >
              (<a href="/files/20210302-ge-micrwoave-owners-manual.pdf"
                >archived</a
              >)
            </li>
          </ul>
        </details>

        <details>
          <summary>Samsung 55-inch QLED Q80T <strong>TV</strong></summary>
          <ul>
            <li>
              <a
                href="https://www.samsung.com/us/televisions-home-theater/tvs/qled-4k-tvs/55-class-q80t-qled-4k-uhd-hdr-smart-tv-2020-qn55q80tafxza/"
                >Product Page</a
              >
            </li>
            <li>
              <a
                href="https://downloadcenter.samsung.com/content/UM/202011/20201116112509205/KT2ATSCT-2.1.5_EM_KANTS_USA_ENG-US_201020.0.pdf"
                >User Manual</a
              >
              (<a href="/files/20210307-q80t-manual.pdf">archived</a>)
            </li>
            <li>
              <a
                href="https://image-us.samsung.com/SamsungUS/PVI/20200122/common-energylabel-qn55q80tafxza-energylabel.pdf"
                >Energy Guide Label</a
              >
              (<a href="/files/20210307-q80t-energy-guide.pdf">archived</a>)
            </li>
            <li>
              <a
                href="https://www.samsung.com/us/support/service/warranty/QN55Q80TAFXZA"
                >Warranty</a
              >
            </li>
          </ul>
        </details>

        <details>
          <summary>
            Bose Noise Cancelling Wireless
            <strong>Bluetooth Headphones</strong> 700
          </summary>
          <ul>
            <li>
              <a
                href="https://www.bose.com/en_us/products/headphones/noise_cancelling_headphones/noise-cancelling-headphones-700.html"
                >Product Page</a
              >
            </li>
            <li>
              <a
                href="https://assets.bose.com/content/dam/Bose_DAM/Web/consumer_electronics/global/products/headphones/noise_cancelling_headphones_700/pdfs/827451_qsg_noise-cancelling-headphones-700_ml.pdf"
                >User Manual</a
              >
              (<a href="/files/20210307-bose-700-user-manual.pdf">archived</a>)
            </li>
            <li>
              <a
                href="https://assets.bose.com/content/dam/Bose_DAM/Web/consumer_electronics/global/products/headphones/noise_cancelling_headphones_700/pdfs/827452_og_noise-cancelling-headphones-700_en.pdf"
                >Quick Start Guide</a
              >
              (<a href="/files/20210307-bose-700-quick-start-guide.pdf"
                >archived</a
              >)
            </li>
          </ul>
        </details>

        <details>
          <summary>
            Old Spice Ultra Smooth Smooth Finish <strong>Deodorant</strong> -
            3.0oz
          </summary>
          <ul>
            <li><a href="https://www.amazon.com/dp/B084Q17M8S/">Amazon</a></li>
          </ul>
        </details>

        <details>
          <summary>ThermoPro TP49 Digital <strong>Hygrometer</strong></summary>
          <ul>
            <li>Battery Type: AAA</li>
            <li><a href="https://www.amazon.com/dp/B07WCR5Y4B/">Amazon</a></li>
            <li>
              <a
                href="https://buythermopro.com/product/thermopro-tp49-digital-indoor-hygrometer-thermometer-humidity-monitor/"
                >ThermoPro product page</a
              >
            </li>
            <li>
              <a
                href="https://buythermopro.com/wp-content/uploads/2019/12/Thermopro-ENFR-TP-49%E8%AF%B4%E6%98%8E%E4%B9%A620190717%E5%B7%B2%E8%BD%AC%E6%9B%B2.pdf"
                >User Manual</a
              >
              (<a href="/files/20210307-thermopro-tp-49-manual.pdf">archived</a
              >)
            </li>
          </ul>
        </details>

        <details>
          <summary>
            simplehuman 10 Liter / 2.6 Gallon In-Cabinet
            <strong>Trash Can</strong>
          </summary>
          <ul>
            <li>simplehuman liner size: R</li>
            <li>Capacity: 2.6 gal / 10L</li>
            <li><a href="https://www.amazon.com/dp/B00DMMW22W/">Amazon</a></li>
            <li>
              <a href="https://www2.simplehuman.com/eu/in-cabinet-can"
                >Product page</a
              >
            </li>
            <li>
              <a
                href="https://cdn.simplehuman.com/media/dimensions/311_0_d_kitchen_incabinet_can_CW1643.jpg"
                >Dimensions</a
              >
              (<a href="/files/20210307-simplehuman-in-cabinet-dimensions.jpg"
                >archived</a
              >)
            </li>
            <li>
              <a
                href="https://images-na.ssl-images-amazon.com/images/I/81jgnQUTQCL._AC_SL1500_.jpg"
                >Cabinet dimension requirements - hanging mount</a
              >
              (<a
                href="/files/20210307-simplehuman-in-cabinet-trash-can-hanging-cabinet-dimensions.jpg"
                >archived</a
              >)
            </li>
            <li>
              <a
                href="https://images-na.ssl-images-amazon.com/images/I/81Iwn%2BqMrWL._AC_SL1500_.jpg"
                >Cabinet dimension requirements - screw mount</a
              >
              (<a
                href="/files/20210307-simplehuman-in-cabinet-trash-can-screw-mount-dimensions.jpg"
                >archived</a
              >)
            </li>
            <li>
              <a
                href="https://images-na.ssl-images-amazon.com/images/I/71cjFi6HGmL.pdf"
                >User manual</a
              >
              (<a href="/files/71cjFi6HGmL.pdf">archived</a>)
            </li>
          </ul>
        </details>

        <details>
          <summary>
            Café™ 30" Smart Slide-In, Front-Control,
            <strong>Dual-Fuel Range</strong> with Warming Drawer
          </summary>
          <ul>
            <li>
              <a
                href="https://www.cafeappliances.com/appliance/Cafe-30-Smart-Slide-In-Front-Control-Dual-Fuel-Range-with-Warming-Drawer-C2S900P2MS1"
                >Product page</a
              >
            </li>
            <li>
              <a
                href="https://products.geappliances.com/MarketingObjectRetrieval/Dispatcher?RequestType=PDF&Name=49-2000201.pdf"
                >use and care manual</a
              >
              (<a href="/files/20210314-use-and-care-manual.pdf">archived</a>)
            </li>
          </ul>
        </details>

        <details>
          <summary>
            Kidde Firex™ AC Hardwired Combination
            <strong>Carbon Monoxide &amp; Photoelectric Smoke Alarm</strong>
          </summary>
          <ul>
            <li>
              <a
                href="https://www.kidde.com/home-safety/en/us/products/fire-safety/combination-smoke-co-alarms/kn-cope-ic/"
                >Product page</a
              >
            </li>
            <li>
              <a
                href="https://www.shareddocs.com/hvac/docs/2001/Public/05/Data_Sheet_Kidde_KN-COPE-IC.pdf"
                >Data Sheet</a
              >
              (<a href="/files/20210321-KN-COPE-IC-data-sheet.pdf">archived</a>)
            </li>
            <li>
              <a
                href="https://www.shareddocs.com/hvac/docs/2001/Public/0E/User-Guide-Kiddde-KN-COPE-IC-Firex-ENG.pdf"
                >User Guide</a
              >
              (<a href="/files/20210321-KN-COPE-IC-user-manual.pdf">archived</a
              >)
            </li>
          </ul>
        </details>

        <details>
          <summary>
            GE® 4.5 cu. ft. Capacity Front Load ENERGY STAR®
            <strong>Washer</strong> with Steam
          </summary>
          <ul>
            <li>Model #: GFW450SSMWW</li>
            <li>
              <a
                href="https://www.geappliances.com/appliance/GE-4-5-cu-ft-Capacity-Front-Load-ENERGY-STAR-Washer-with-Steam-GFW450SSMWW"
                >Product page</a
              >
            </li>
            <li>
              <a
                href="https://products.geappliances.com/appliance/gea-specs/GFW450SSMWW/support"
                >Maintenance Page</a
              >
            </li>
            <li>
              <a
                href="https://products.geappliances.com/MarketingObjectRetrieval/Dispatcher?RequestType=PDF&Name=49-90583-2.pdf"
                >Owner's Manual</a
              >
              (<a href="/files/20211017-GFW450SSMWW-owners-manual.pdf"
                >archived</a
              >)
            </li>
          </ul>
        </details>

        <details>
          <summary>
            GE® 7.5 cu. ft. Capacity Front Load
            <strong>Electric Dryer</strong> with Steam
          </summary>
          <ul>
            <li>
              <a
                href="https://www.geappliances.com/appliance/GE-7-5-cu-ft-Capacity-Front-Load-Electric-Dryer-with-Steam-GFD45ESSMWW"
                >Product page</a
              >
            </li>
            <li>
              <a
                href="https://products.geappliances.com/MarketingObjectRetrieval/Dispatcher?RequestType=PDF&Name=GFD45ESSM_ESPM_C4_18.pdf"
                >Quick Specs</a
              >
              (<a href="/files/20211017-GFD45ESSMWW-quick-specs.pdf">archived</a
              >)
            </li>
            <li>
              <a
                href="https://products.geappliances.com/MarketingObjectRetrieval/Dispatcher?RequestType=PDF&Name=49-90585.PDF"
                >Owner's Manual</a
              >
              (<a href="/files/20211017-GFD45ESSMWW-owners-manual.pdf"
                >archived</a
              >)
            </li>
          </ul>
        </details>
      `,
    }),
  );
});
