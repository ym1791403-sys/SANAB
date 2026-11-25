// Verified agricultural plant pathology knowledge base (Arabic + English)
// Used as fallback reference and for one-click seeding into Firebase Firestore (`diseases` & `quiz_questions`).

export const CROPS = [
  { id: "all", ar: "الكل", en: "All Crops" },
  { id: "tomato", ar: "طماطم", en: "Tomato" },
  { id: "potato", ar: "بطاطس", en: "Potato" },
  { id: "wheat", ar: "قمح", en: "Wheat" },
  { id: "cucumber", ar: "خيار وقرعيات", en: "Cucumber & Cucurbits" },
  { id: "pepper", ar: "فلفل", en: "Pepper" },
  { id: "grape", ar: "عنب وفواكه", en: "Grape & Fruits" }
];

export const PATHOGEN_TYPES = {
  fungal: { ar: "فطري", en: "Fungal" },
  bacterial: { ar: "بكتيري", en: "Bacterial" },
  viral: { ar: "فيروسي", en: "Viral" },
  pest: { ar: "آفة حشرية / أكاروس", en: "Pest / Mite" },
  nutrient: { ar: "نقص عناصر", en: "Nutrient Deficiency" }
};

export const DISEASES_DATA = [
  {
    id: "late-blight",
    crop: "tomato",
    crops: ["tomato", "potato"],
    cropAr: "الطماطم والبطاطس",
    cropEn: "Tomato & Potato",
    nameAr: "اللفحة المتأخرة",
    nameEn: "Late Blight",
    scientificName: "Phytophthora infestans",
    pathogenType: "fungal",
    severity: "high",
    severityAr: "شديدة",
    severityEn: "Severe",
    image: "./assets/diseases/late-blight.jpg",
    symptomsAr: "ظهور بقع بنية داكنة مائية غير منتظمة على حواف الأوراق، مع وجود زغب أبيض خفيف على السطح السفلي للأوراق في الأجواء الرطبة، وقد تمتد للساق والثمار مسببة تعفناً سريعاً.",
    symptomsEn: "Irregular water-soaked dark brown lesions along leaf edges with pale white mold growth on the underside in humid weather; can rapidly spread to stems and fruits.",
    bioTreatmentAr: [
      "إزالة وحرق الأوراق والثمار المصابة فوراً بعيداً عن الحقل لمنع انتشار الجراثيم.",
      "تحسين التهوية بين النباتات وتجنب الري بالرشاشات الرأسية.",
      "رش مستخلصات حيوية وقائية مثل مركبات الباسيلس (Bacillus subtilis) أو شاي الكومبوست الجيد قبل اشتداد الرطوبة."
    ],
    bioTreatmentEn: [
      "Immediately remove and destroy infected leaves away from the field.",
      "Improve plant spacing/air circulation and avoid overhead sprinkler irrigation.",
      "Apply preventive bio-fungicides such as Bacillus subtilis formulations before high humidity."
    ],
    chemTreatmentAr: [
      "الرش الوقائي بمركبات النحاس المعتمدة مثل أوكسي كلوريد النحاس طبقاً لتوصية وزارة الزراعة.",
      "في حالات الإصابة الفعلية: استخدام مبيدات جهازية/موضعية متخصصة مثل ميتالاكسيل + مانكوزيب أو سيموكسانيل تحت إشراف مهندس زراعي."
    ],
    chemTreatmentEn: [
      "Preventive spray with approved copper oxychloride fungicides per label rates.",
      "For active infections: targeted fungicides containing metalaxyl-M + mancozeb or cymoxanil under agronomist supervision."
    ],
    preventionAr: [
      "زراعة أصناف مقاومة أو متحملة لللفحة المتأخرة.",
      "تجنب الري في ساعات المساء لعدم بقاء الماء على الأوراق طوال الليل.",
      "تطبيق دورة زراعية ثلاثية وعدم زراعة البطاطس بجوار الطماطم."
    ],
    preventionEn: [
      "Plant resistant or tolerant tomato and potato cultivars.",
      "Avoid evening irrigation so foliage dries before nightfall.",
      "Practice 3-year crop rotation and avoid planting tomatoes directly next to potatoes."
    ],
    lookalikeNoteAr: "تختلف عن اللفحة المبكرة في أن بقعها مائية غير منتظمة وغالباً يظهر تحتها زغب أبيض في الصباح الباكر، بينما اللفحة المبكرة تظهر بحلقات دائرية متداخلة تشبه لوحة التصويب.",
    lookalikeNoteEn: "Differs from Early Blight by water-soaked irregular margins and white downy sporulation underneath in high humidity, rather than dry concentric target rings."
  },
  {
    id: "early-blight",
    crop: "tomato",
    crops: ["tomato", "potato"],
    cropAr: "الطماطم والبطاطس",
    cropEn: "Tomato & Potato",
    nameAr: "اللفحة المبكرة",
    nameEn: "Early Blight",
    scientificName: "Alternaria solani",
    pathogenType: "fungal",
    severity: "medium",
    severityAr: "متوسطة",
    severityEn: "Moderate",
    image: "./assets/diseases/early-blight.jpg",
    symptomsAr: "بقع بنية دائرية على الأوراق السفلية المسنة تتميز بحلقات متداخلة تشبه هدف الرماية، وتُحاط غالباً بهالة صفراء مع جفاف وموت الأنسجة المصابة.",
    symptomsEn: "Circular brown lesions on older lower leaves showing characteristic concentric target-like rings, often surrounded by a yellow halo.",
    bioTreatmentAr: [
      "تقليم الأوراق السفلية المصابة وتجنب ملامسة الأوراق للتربة.",
      "تغطية التربة بالملش لتقليل تطاير الجراثيم من التربة أثناء الري.",
      "استخدام رشات وقائية بـ Trichoderma أو مستخلصات طبيعية مقوية للنبات."
    ],
    bioTreatmentEn: [
      "Prune infected lower leaves and keep foliage off the soil.",
      "Use soil mulch to prevent spore splash during watering.",
      "Apply preventive Trichoderma-based biological agents."
    ],
    chemTreatmentAr: [
      "استخدام مبيدات وقائية معتمدة تحتوي على مانكوزيب أو كلوروثالونيل عند بدء الأعراض.",
      "في الحالات المتقدمة: أزوكسيستروبين أو ديفينوكونازول بالتبادل لمنع مقاومة الفطر وبإشراف مهندس."
    ],
    chemTreatmentEn: [
      "Apply approved protectant fungicides such as mancozeb or chlorothalonil at onset.",
      "Rotate with azoxystrobin or difenoconazole if spreading, under agronomist guidance."
    ],
    preventionAr: [
      "التسميد المتوازن (خاصة البوتاسيوم) لزيادة مناعة الأوراق.",
      "تنظيف بقايا المحصول السابق جيداً بعد الحصاد.",
      "الري بالتنقيط بدلاً من الغمر أو الرش."
    ],
    preventionEn: [
      "Maintain balanced potassium fertilization to strengthen leaf tissue.",
      "Remove crop debris thoroughly after harvest.",
      "Prefer drip irrigation over overhead watering."
    ],
    lookalikeNoteAr: "اللفحة المبكرة تبدأ عادة على الأوراق المسنة السفلية بحلقات دائرية واضحة (Target rings)، على عكس اللفحة المتأخرة التي تهاجم أي عمر بسرعة في الجو البارد الرطب.",
    lookalikeNoteEn: "Starts on older lower leaves with distinct bullseye concentric rings, whereas Late Blight spreads explosively on any foliage during cool wet weather."
  },
  {
    id: "wheat-leaf-rust",
    crop: "wheat",
    crops: ["wheat"],
    cropAr: "القمح",
    cropEn: "Wheat",
    nameAr: "صدأ الأوراق (الصدأ البرتقالي)",
    nameEn: "Wheat Leaf Rust",
    scientificName: "Puccinia triticina",
    pathogenType: "fungal",
    severity: "medium",
    severityAr: "متوسطة",
    severityEn: "Moderate",
    image: "./assets/diseases/wheat-leaf-rust.jpg",
    symptomsAr: "بثرات دائرية صغيرة برتقالية إلى بنية محمرة موزعة عشوائياً على السطح العلوي لأوراق القمح، تترك أثراً يشبه الصدأ عند لمسها.",
    symptomsEn: "Small round orange-red to reddish-brown pustules scattered randomly on the upper leaf surface that release powdery rust spores when touched.",
    bioTreatmentAr: [
      "المتابعة الدورية للحقل فور ظهور أول بثرات للتدخل المبكر.",
      "تجنب الإفراط في التسميد الآزوتي (النيتروجين) الذي يجعل الأنسجة غضة وقابلة للإصابة.",
      "رش مستخلصات الكبريت الميكروني أو زيت النيم 1% في البؤر الأولى للمكافحة المبكرة."
    ],
    bioTreatmentEn: [
      "Scout fields regularly to detect early foci.",
      "Avoid excessive nitrogen fertilization that promotes soft susceptible foliage.",
      "Apply micronized sulfur or neem extract sprays at very early focal spots."
    ],
    chemTreatmentAr: [
      "رش مركبات التريازول المعتمدة للقمح (مثل تيبوكونازول أو بروبيكونازول) بالمعدل الموصى به فور تجاوز العتبة الاقتصادية للإصابة."
    ],
    chemTreatmentEn: [
      "Apply recommended wheat triazole fungicides (e.g., tebuconazole or propiconazole) at labeled rates once threshold is reached."
    ],
    preventionAr: [
      "الالتزام بمواعيد الزراعة الموصى بها في محافظتك.",
      "زراعة تقاوي معتمدة ومقاومة للأصداء من الأصناف الموصى بها محلياً.",
      "التخلص من الحشائش النجيلية العائلة للفطر حول الحقل."
    ],
    preventionEn: [
      "Follow regionally recommended sowing dates.",
      "Plant certified rust-resistant wheat varieties.",
      "Control volunteer wheat and grassy weeds near field margins."
    ],
    lookalikeNoteAr: "الصدأ البرتقالي (صدأ الأوراق) تكون بثراته دائرية مبعثرة على الورقة، أما الصدأ الأصفر فتترتب بثراته في خطوط طولية متوازية بين عروق الورقة.",
    lookalikeNoteEn: "Leaf rust forms scattered round orange pustules, unlike Stripe (Yellow) Rust whose pustules align in long linear stripes along leaf veins."
  },
  {
    id: "powdery-mildew",
    crop: "cucumber",
    crops: ["cucumber", "pepper", "grape", "tomato"],
    cropAr: "الخيار والقرعيات والفلفل",
    cropEn: "Cucumber, Pepper & Grape",
    nameAr: "البياض الدقيقي",
    nameEn: "Powdery Mildew",
    scientificName: "Podosphaera xanthii / Erysiphe",
    pathogenType: "fungal",
    severity: "medium",
    severityAr: "متوسطة",
    severityEn: "Moderate",
    image: "./assets/diseases/powdery-mildew.jpg",
    symptomsAr: "ظهور بقع بيضاء دقيقية الملمس (تشبه البودرة) على السطح العلوي وأحياناً السفلي للأوراق والسيقان، يتبعها اصفرار وجفاف الأوراق.",
    symptomsEn: "White powdery talcum-like fungal patches on upper leaf surfaces and stems, eventually causing yellowing and premature leaf drop.",
    bioTreatmentAr: [
      "رش بيكربونات البوتاسيوم أو محلول بيكربونات الصوديوم المخفف مع صابون زراعي آمن.",
      "استخدام الكبريت الميكروني القابل للبلل في الأجواء المعتدلة (تجنبه إذا تخطت الحرارة 32° م).",
      "رش مستخلص زيت النيم في الصباح الباكر."
    ],
    bioTreatmentEn: [
      "Spray potassium bicarbonate solutions with horticultural soap.",
      "Apply wettable micronized sulfur when temperatures are below 32°C.",
      "Use cold-pressed neem oil early in the morning."
    ],
    chemTreatmentAr: [
      "استخدام مبيدات فطرية متخصصة مثل أزوكسيستروبين أو بينكونازول أو تريفلوكسيستروبين بالتبادل."
    ],
    chemTreatmentEn: [
      "Rotate systemic fungicides such as penconazole, azoxystrobin, or trifloxystrobin per label guidance."
    ],
    preventionAr: [
      "تقليل الكثافة النباتية وتقليم الأفرع المتزاحمة لضمان التهوية.",
      "تجنب التسميد النيتروجيني الزائد والاهتمام بعنصر البوتاسيوم والسيليكون.",
      "الجمع المستمر للأوراق شديدة الإصابة."
    ],
    preventionEn: [
      "Avoid overcrowding and prune dense canopy for airflow.",
      "Balance nitrogen with sufficient potassium.",
      "Sanitize tools and remove severely infected older leaves."
    ],
    lookalikeNoteAr: "البياض الدقيقي ينمو كطبقة بيضاء بودرية فوق السطح العلوي للورقة ويزدهر في الجو الدافئ الجاف نسبياً، بعكس البياض الزغبي الذي يظهر على السطح السفلي ويحب البلل والندى.",
    lookalikeNoteEn: "Forms white chalky powder primarily on upper surfaces in warm dry-to-humid conditions, unlike Downy Mildew which creates purplish-gray fuzz beneath wet leaves."
  },
  {
    id: "downy-mildew",
    crop: "grape",
    crops: ["grape", "cucumber"],
    cropAr: "العنب والخيار",
    cropEn: "Grape & Cucumber",
    nameAr: "البياض الزغبي",
    nameEn: "Downy Mildew",
    scientificName: "Plasmopara viticola / Pseudoperonospora",
    pathogenType: "fungal",
    severity: "high",
    severityAr: "شديدة",
    severityEn: "Severe",
    image: "./assets/diseases/downy-mildew.jpg",
    symptomsAr: "بقع صفراء باهتة (زيتية المظهر) على السطح العلوي للأوراق محصورة غالباً بين العروق، يقابلها نمو زغبي أبيض رمادي على السطح السفلي.",
    symptomsEn: "Pale yellow oily angular spots bounded by leaf veins on the upper surface, matched by whitish-gray downy growth on the underside.",
    bioTreatmentAr: [
      "إزالة الأوراق المصابة وتحسين تهوية الصوب أو الكروم.",
      "تقليل الرطوبة الأرضية وتنظيم الري.",
      "استخدام مركبات حيوية تحتوي على مستخلصات الأعشاب البحرية والنحاس الحيوي."
    ],
    bioTreatmentEn: [
      "Remove affected leaves and maximize greenhouse or vineyard ventilation.",
      "Reduce surface moisture and avoid evening irrigation.",
      "Apply approved copper or bio-stimulant defense sprays preventively."
    ],
    chemTreatmentAr: [
      "مركبات النحاس الوقائية قبل ظهور الأعراض في المواسم الرطبة.",
      "عند بدء الإصابة: سيموكسانيل + مانكوزيب أو فوسيتيل ألومنيوم أو ديميثومورف تحت إشراف مهندس."
    ],
    chemTreatmentEn: [
      "Preventive copper sprays ahead of damp weather.",
      "Curative sprays such as cymoxanil, dimethomorph, or fosetyl-Al rotated carefully."
    ],
    preventionAr: [
      "تهوية الصوب الزراعية باكراً لطرد الندى الصباحي.",
      "تجنب الري بالرش وتفضيل الري بالتنقيط.",
      "زراعة هجن مقاومة للبياض الزغبي."
    ],
    preventionEn: [
      "Ventilate greenhouses early morning to clear condensation.",
      "Use drip irrigation rather than overhead sprinklers.",
      "Choose downy mildew-tolerant hybrids."
    ],
    lookalikeNoteAr: "تظهر بقع البياض الزغبي محددة بزاوية العروق على السطح العلوي بينما يختبئ الزغب الفطري على السطح السفلي للورقة.",
    lookalikeNoteEn: "Upper lesions are angular and vein-limited ('mosaic yellow spots'), while actual fungal sporulation appears strictly on the leaf underside."
  },
  {
    id: "fusarium-wilt",
    crop: "tomato",
    crops: ["tomato", "pepper", "cucumber"],
    cropAr: "الطماطم والفلفل",
    cropEn: "Tomato & Pepper",
    nameAr: "ذبول الفيوزاريوم الوعائي",
    nameEn: "Fusarium Wilt",
    scientificName: "Fusarium oxysporum",
    pathogenType: "fungal",
    severity: "high",
    severityAr: "شديدة",
    severityEn: "Severe",
    image: "./assets/diseases/fusarium-wilt.jpg",
    symptomsAr: "اصفرار وذبول الأوراق السفلية غالباً على جانب واحد من النبات أولاً، مع تلون الأوعية الناقلة باللون البني عند شق الساق طولياً قرب سطح التربة.",
    symptomsEn: "Yellowing and wilting of lower leaves often starting on one side of the plant; longitudinal stem cut near soil line reveals brown vascular discoloration.",
    bioTreatmentAr: [
      "لا يوجد علاج شافٍ للنباتات شديدة الذبول؛ يجب اقتلاعها والتخلص منها خارج الحقل.",
      "دعم التربة بفطريات الترايكوديرما (Trichoderma harzianum) وبكتيريا الباسيلس لحماية الجذور السليمة.",
      "تحسين صرف التربة وتجنب تغريق الجذور."
    ],
    bioTreatmentEn: [
      "Remove and destroy severely wilted plants to limit soil inoculum buildup.",
      "Drench healthy plants' root zones with Trichoderma harzianum and Bacillus bio-protectants.",
      "Improve soil drainage and prevent waterlogging."
    ],
    chemTreatmentAr: [
      "حقن التربة بمبيدات فطرية متخصصة لجذور الأصحاء للحد من الانتشار (مثل أزوكسيستروبين أو ثيوفانات ميثيل وفق توصية المهندس).",
      "تعقيم التربة شمسياً قبل الزراعة التالية."
    ],
    chemTreatmentEn: [
      "Soil drench with registered systemic fungicides around neighboring healthy roots under agronomist guidance.",
      "Solarize soil prior to next planting cycle."
    ],
    preventionAr: [
      "استخدام شتلات مطعومة على أصول مقاومة للفيوزاريوم والنيماتودا.",
      "مكافحة نيماتودا التربة لأنها تسهل دخول فطر الفيوزاريوم للجذور.",
      "اتباع دورة زراعية طويلة مع محاصيل غير عائلية."
    ],
    preventionEn: [
      "Use grafted seedlings on Fusarium- and nematode-resistant rootstocks.",
      "Control root-knot nematodes which create entry wounds.",
      "Rotate out of solanaceous crops for 3-4 seasons."
    ],
    lookalikeNoteAr: "الفيوزاريوم يسبب اصفراراً تدريجياً وتلوناً بنياً في الأوعية بدون إفرازات بكتيرية لزجة، على عكس الذبول البكتيري الذي يؤدي لذبول مفاجئ للنبات وهو ما زال أخضر.",
    lookalikeNoteEn: "Causes progressive yellowing and dry brown vascular streaking without bacterial ooze, unlike Bacterial Wilt which causes sudden green collapse."
  },
  {
    id: "magnesium-deficiency",
    crop: "potato",
    crops: ["potato", "tomato", "pepper", "cucumber"],
    cropAr: "البطاطس والطماطم",
    cropEn: "Potato & Tomato",
    nameAr: "نقص عنصر الماغنسيوم",
    nameEn: "Magnesium Deficiency",
    scientificName: "Abiotic Nutrient Disorder (Mg)",
    pathogenType: "nutrient",
    severity: "low",
    severityAr: "منخفضة",
    severityEn: "Low",
    image: "./assets/diseases/magnesium-deficiency.jpg",
    symptomsAr: "اصفرار واضح بين عروق الأوراق المسنة السفلية مع بقاء العروق نفسها خضراء (اصفرار شبكي)، وقد تتحول الحواف أحياناً للون الأرجواني أو البني.",
    symptomsEn: "Interveinal chlorosis (yellowing between veins) on older lower leaves while main leaf veins stay green; margins may turn reddish or necrotic if prolonged.",
    bioTreatmentAr: [
      "إضافة الدولوميت المطحون أو الكومبوست الغني بالمعادن للتربة لتعديل الماغنسيوم والكالسيوم.",
      "ضبط حموضة التربة (pH) وتجنب الإفراط في التسميد البوتاسي أو الكالسيومي الذي يعيق امتصاص الماغنسيوم."
    ],
    bioTreatmentEn: [
      "Amend acidic soils with dolomitic limestone or mineral-rich compost.",
      "Avoid excessive potassium fertilization that antagonizes Mg uptake."
    ],
    chemTreatmentAr: [
      "تسميد ورقي سريع الامتصاص بسلفات الماغنسيوم (ملح إنجليزي زراعي بتركيز 1.5 - 2%) أو نترات الماغنسيوم.",
      "إضافة سلفات الماغنسيوم مع مياه الري حسب تحليل التربة."
    ],
    chemTreatmentEn: [
      "Foliar spray with 1.5–2% magnesium sulfate (Epsom salt) for rapid leaf recovery.",
      "Fertigate with magnesium sulfate or magnesium nitrate per soil test."
    ],
    preventionAr: [
      "فحص التربة وتحليل نسبة العناصر بانتظام قبل بدء الموسم.",
      "تطبيق برنامج تسميد متوازن يراعي النسبة بين البوتاسيوم والماغنسيوم والكالسيوم."
    ],
    preventionEn: [
      "Conduct regular pre-season soil nutrient analysis.",
      "Maintain balanced K:Mg:Ca ratios in fertigation schedules."
    ],
    lookalikeNoteAr: "نقص الماغنسيوم يبدأ دائماً على الأوراق السفلية المسنة مع بقاء العروق خضراء، بينما نقص الحديد يبدأ على القمة النامية والأوراق الحديثة.",
    lookalikeNoteEn: "Appears on older lower leaves first (mobile nutrient), whereas iron deficiency causes interveinal yellowing on young upper leaves."
  },
  {
    id: "tomato-curl-virus",
    crop: "tomato",
    crops: ["tomato", "pepper"],
    cropAr: "الطماطم",
    cropEn: "Tomato",
    nameAr: "فيروس تجعد واصفرار أوراق الطماطم",
    nameEn: "Tomato Yellow Leaf Curl Virus (TYLCV)",
    scientificName: "Begomovirus (TYLCV)",
    pathogenType: "viral",
    severity: "high",
    severityAr: "شديدة",
    severityEn: "Severe",
    image: "./assets/diseases/tomato-curl-virus.jpg",
    symptomsAr: "التفاف حواف الأوراق الحديثة لأعلى على شكل ملعقة مع اصفرار الحواف وتقزم واضح للنبات وتساقط الأزهار.",
    symptomsEn: "Upward cupping and curling of young leaves, marginal yellowing, severe plant stunting, and blossom drop.",
    bioTreatmentAr: [
      "لا يوجد مبيد يعالج الفيروس داخل النبات؛ يتم قلع الشتلات المصابة مبكراً لمنع نقل العدوى.",
      "استخدام المصائد الصفراء اللاصقة لمكافحة الذبابة البيضاء الناقل الرئيسي للفيروس.",
      "رش الزيوت المعدنية الصيفية أو الصابون البوتاسي لتقليل تعداد الذبابة البيضاء."
    ],
    bioTreatmentEn: [
      "No chemical cures viral infection; rogue out early infected seedlings to protect neighbors.",
      "Deploy yellow sticky traps to reduce whitefly vectors.",
      "Use insecticidal potassium soap or botanical oils against whiteflies."
    ],
    chemTreatmentAr: [
      "مكافحة الحشرة الناقلة (الذبابة البيضاء) بمبيدات حشرية متخصصة ومعتمدة مع تدوير المجموعات الكيميائية لمنع المناعة."
    ],
    chemTreatmentEn: [
      "Manage the whitefly vector using rotated registered insecticides recommended by local extension services."
    ],
    preventionAr: [
      "تغطية المشاتل بشبك مانع للحشرات (نت ضد الذبابة البيضاء).",
      "زراعة أصناف طماطم هجين مقاومة لفيروس تجعد الأوراق (TY).",
      "التخلص من الحشائش التي تأوي الذبابة البيضاء."
    ],
    preventionEn: [
      "Protect nurseries with fine insect-proof mesh netting.",
      "Plant TYLCV-resistant tomato hybrids.",
      "Remove weed hosts around fields."
    ],
    lookalikeNoteAr: "يختلف عن تجعد الأوراق الفسيولوجي الناتج عن العطش أو الحرارة في أن الفيروس يتركز في القمة النامية ويصاحبه اصفرار وتقزم شديد ووجود ذبابة بيضاء.",
    lookalikeNoteEn: "Unlike physiological heat/water leaf roll (which affects older leaves without stunting), TYLCV stunts new crown growth with bright yellow margins."
  },
  {
    id: "gray-mold",
    crop: "grape",
    crops: ["grape", "tomato", "cucumber", "pepper"],
    cropAr: "العنب والطماطم والخضروات",
    cropEn: "Grape, Tomato & Vegetables",
    nameAr: "العفن الرمادي (البوترايتس)",
    nameEn: "Gray Mold (Botrytis)",
    scientificName: "Botrytis cinerea",
    pathogenType: "fungal",
    severity: "medium",
    severityAr: "متوسطة",
    severityEn: "Moderate",
    image: "./assets/diseases/gray-mold.jpg",
    symptomsAr: "نمو عفن قطني رمادي مائل للبني على الأزهار والثمار والأجزاء المجروحة أو الرطبة داخل المجموع الخضري الكثيف.",
    symptomsEn: "Fuzzy gray-brown sporulating mold on blossoms, fruits, and wounded stems in damp, poorly ventilated canopies.",
    bioTreatmentAr: [
      "جمع الأجزاء المتعفنة بحرص في أكياس مغلقة حتى لا تتطاير الجراثيم.",
      "خفض الرطوبة النسبية بالتهوية الجيدة وتقليل الري.",
      "تطبيق مركبات حيوية مثل Gliocladium أو Bacillus على الأزهار."
    ],
    bioTreatmentEn: [
      "Carefully bag and remove moldy plant parts to avoid dispersing spores.",
      "Lower humidity via aggressive ventilation and pruning.",
      "Apply approved biological antagonists during flowering."
    ],
    chemTreatmentAr: [
      "استخدام مبيدات متخصصة ضد البوترايتس (مثل فينهيكساميد أو بوسكاليد أو سايبرودينيل) مع الالتزام بفترة ما قبل الحصاد (PHI)."
    ],
    chemTreatmentEn: [
      "Apply Botrytis-specific fungicides respecting pre-harvest intervals (PHI)."
    ],
    preventionAr: [
      "تجنب تجريح السيقان والثمار أثناء عمليات الخدمة والتقليم.",
      "التخلص من بقايا الأزهار الجافة الملتصقة بالثمار."
    ],
    preventionEn: [
      "Avoid wounding stems and fruits during pruning/harvest.",
      "Remove senescent flower petals clinging to young fruits."
    ],
    lookalikeNoteAr: "يتميز العفن الرمادي بغطاء وبري رمادي كثيف يطلق غباراً من الجراثيم عند لمسه على الثمار والأزهار.",
    lookalikeNoteEn: "Distinguished by velvety mouse-gray spore clouds on senescent flowers, stems, and ripening fruit."
  },
  {
    id: "spider-mites",
    crop: "cucumber",
    crops: ["cucumber", "tomato", "pepper"],
    cropAr: "الخيار والطماطم والفلفل",
    cropEn: "Cucumber, Tomato & Pepper",
    nameAr: "العنكبوت الأحمر ذو البقعتين",
    nameEn: "Two-Spotted Spider Mite",
    scientificName: "Tetranychus urticae",
    pathogenType: "pest",
    severity: "medium",
    severityAr: "متوسطة",
    severityEn: "Moderate",
    image: "./assets/diseases/spider-mites.jpg",
    symptomsAr: "ظهور نقط صفراء باهتة متقاربة (مظهر برونزي) على السطح العلوي للأوراق، مع خيوط عنكبوتية دقيقة وأفراد دقيقة متحركة على السطح السفلي خاصة في الجو الحار الجاف.",
    symptomsEn: "Fine yellow stippling/bronzing on upper leaves with delicate webbing and tiny moving mites on leaf undersides during hot dry weather.",
    bioTreatmentAr: [
      "رش النباتات بالماء النظيف لتنظيف الغبار ورفع الرطوبة الموضعية غير الملائمة للعنكبوت.",
      "إطلاق المفترس الأكاروسي الحيوي (Phytoseiulus persimilis) في الصوب.",
      "استخدام الصابون البوتاسي أو الزيوت النباتية مع تغطية السطح السفلي للأوراق."
    ],
    bioTreatmentEn: [
      "Wash leaf undersides with water jets to reduce dust and dry stress.",
      "Release predatory mites (Phytoseiulus persimilis) in greenhouses.",
      "Spray insecticidal soap or horticultural oil thoroughly onto leaf undersides."
    ],
    chemTreatmentAr: [
      "استخدام مبيد أكاروسي متخصص (وليس مبيد حشري عادي!) مثل أبامكتين أو هيكسيثيازوكس بالتبادل لتفادي المقاومة."
    ],
    chemTreatmentEn: [
      "Use a true acaricide/miticide (not generic insecticides), rotating modes of action such as abamectin or hexythiazox."
    ],
    preventionAr: [
      "تجنب إجهاد العطش للنباتات في الصيف.",
      "ترشيد استخدام المبيدات الحشرية البيروثرويدية التي تقتل الأعداء الطبيعية وتفجر أعداد العنكبوت."
    ],
    preventionEn: [
      "Prevent drought stress in hot summer months.",
      "Avoid broad-spectrum pyrethroids that kill natural mite predators."
    ],
    lookalikeNoteAr: "أعراض التنقيط الأصفر تتشابه مع التربس أو نقص عناصر خفيف؛ افحص السطح السفلي بعدسة مكبرة للتأكد من وجود النسيج العنكبوتي والأفراد.",
    lookalikeNoteEn: "Upper leaf stippling can mimic thrips or mild nutrient issues; inspect the leaf underside with a 10x lens for fine webbing and mites."
  },
  {
    id: "bacterial-wilt",
    crop: "potato",
    crops: ["potato", "tomato", "pepper"],
    cropAr: "البطاطس والطماطم",
    cropEn: "Potato & Tomato",
    nameAr: "الذبول البكتيري (العفن البني في البطاطس)",
    nameEn: "Bacterial Wilt / Brown Rot",
    scientificName: "Ralstonia solanacearum",
    pathogenType: "bacterial",
    severity: "high",
    severityAr: "شديدة",
    severityEn: "Severe",
    image: "./assets/diseases/bacterial-wilt.jpg",
    symptomsAr: "ذبول مفاجئ وسريع للمجموع الخضري وهو ما زال أخضر اللون دون اصفرار مسبق، وعند وضع قطعة من الساق في كوب ماء صافٍ تنساب خيوط بكتيرية حليبية بيضاء.",
    symptomsEn: "Sudden green wilting of shoots without prior yellowing; placing a cut stem base in clear water streams milky bacterial ooze downward.",
    bioTreatmentAr: [
      "اقتلاع النباتات المصابة فوراً بالتربة المحيطة بها وحرقها خارج الحقل.",
      "منع نقل مياه الري من البؤر المصابة لبقية الخطوط.",
      "تطهير أدوات التقليم والحصاد بمحلول مطهر."
    ],
    bioTreatmentEn: [
      "Immediately uproot and destroy infected plants without shaking soil across rows.",
      "Isolate irrigation runoff from affected beds.",
      "Sanitize pruning knives and tools between plants."
    ],
    chemTreatmentAr: [
      "لا توجد مبيدات فطرية أو بكتيرية تعالج النبات المصاب بعد دخول البكتيريا للأوعية؛ التركيز على الحجر الصحي والوقاية وتقاوي خالية من العفن البني."
    ],
    chemTreatmentEn: [
      "No curative spray clears systemic bacterial wilt; focus strictly on quarantine, clean certified seed tubers, and rotation."
    ],
    preventionAr: [
      "استخدام تقاوي بطاطس معتمدة مفحوصة وخالية تماماً من العفن البني.",
      "الدورة الزراعية الطويلة والابتعاد عن الأراضي الموبوءة بالباذنجانيات."
    ],
    preventionEn: [
      "Plant only certified disease-free seed tubers.",
      "Enforce long crop rotations away from Solanaceae in contaminated fields."
    ],
    lookalikeNoteAr: "الاختبار الميداني السريع بكوب الماء يكشف الخيوط البكتيرية البيضاء ويميزها عن ذبول الفيوزاريوم الفطري.",
    lookalikeNoteEn: "The clear-glass stem ooze test quickly distinguishes Bacterial Wilt from fungal Fusarium or Verticillium wilt."
  },
  {
    id: "anthracnose",
    crop: "pepper",
    crops: ["pepper", "tomato", "cucumber"],
    cropAr: "الفلفل والطماطم",
    cropEn: "Pepper & Tomato",
    nameAr: "الأنثراكنوز (تبقع الثمار الغائر)",
    nameEn: "Anthracnose",
    scientificName: "Colletotrichum spp.",
    pathogenType: "fungal",
    severity: "medium",
    severityAr: "متوسطة",
    severityEn: "Moderate",
    image: "./assets/diseases/anthracnose.jpg",
    symptomsAr: "بقع دائرية غائرة وطرية على الثمار الناضجة أو شبه الناضجة، تتكون بداخلها حلقات داكنة مع كتل جراثيم وردية أو برتقالية في الجو الرطب.",
    symptomsEn: "Sunken circular water-soaked lesions on ripening fruits containing concentric dark rings and salmon-pink spore masses in damp conditions.",
    bioTreatmentAr: [
      "جمع الثمار المصابة والتخلص منها وعدم تركها تتعفن على النبات أو التربة.",
      "تقليل الرطوبة وعدم رش الثمار بالماء قبل الحصاد."
    ],
    bioTreatmentEn: [
      "Harvest and discard infected fruits promptly.",
      "Avoid wetting fruits during irrigation."
    ],
    chemTreatmentAr: [
      "استخدام مبيدات وقائية نحاسية أو أزوكسيستروبين في مراحل الإزهار وعقد الثمار في الحقول التي سبقت فيها الإصابة."
    ],
    chemTreatmentEn: [
      "Apply copper protectants or strobilurin fungicides preventively from fruit set where history exists."
    ],
    preventionAr: [
      "استخدام بذور سليمة معاملة، وتطبيق دورة زراعية لمدة 3 سنوات.",
      "تجفيف الثمار جيداً بعد الغسل وتخزينها في درجة حرارة مناسبة."
    ],
    preventionEn: [
      "Use pathogen-free treated seed and 3-year crop rotation.",
      "Keep harvested produce dry and cool."
    ],
    lookalikeNoteAr: "بقع الأنثراكنوز غائرة ومحددة الحواف على الثمرة وتنتج جراثيم برتقالية/وردية، بعكس عفن طرف الزهرة الناتج عن نقص الكالسيوم عند طرف الثمرة السفلي.",
    lookalikeNoteEn: "Circular sunken lesions with concentric rings on fruit sides differ from blossom end rot (calcium disorder) at the bottom tip."
  }
];

export const QUIZ_QUESTIONS = [
  {
    id: "q1",
    image: "./assets/diseases/late-blight.jpg",
    questionAr: "عند فحص أوراق الطماطم في جو رطب بارد، لوحظت بقع بنية مائية غير منتظمة وزغب أبيض على السطح السفلي للورقة. ما التشخيص الأقرب؟",
    questionEn: "In cool humid weather, tomato leaves show irregular water-soaked brown lesions with faint white fuzz underneath. What is the most likely issue?",
    optionsAr: ["اللفحة المتأخرة", "البياض الدقيقي", "نقص عنصر الماغنسيوم", "العنكبوت الأحمر"],
    optionsEn: ["Late Blight", "Powdery Mildew", "Magnesium Deficiency", "Two-Spotted Spider Mite"],
    correctIndex: 0,
    tipAr: "لاحظ أن البقع غير منتظمة ومائية ويوجد زغب أبيض على السطح السفلي، وهي علامة مميزة لفطر Phytophthora infestans.",
    tipEn: "Irregular water-soaked lesions with white sporulation beneath are characteristic of Phytophthora infestans."
  },
  {
    id: "q2",
    image: "./assets/diseases/early-blight.jpg",
    questionAr: "ما المرض الذي يظهر أولاً على الأوراق السفلية المسنة على هيئة بقع بنية ذات حلقات دائرية متداخلة تشبه هدف التصويب؟",
    questionEn: "Which disease starts on older lower leaves with circular brown spots containing concentric target-like rings?",
    optionsAr: ["صدأ الأوراق", "اللفحة المبكرة", "فيروس تجعد الأوراق", "الذبول البكتيري"],
    optionsEn: ["Wheat Leaf Rust", "Early Blight", "Yellow Leaf Curl Virus", "Bacterial Wilt"],
    correctIndex: 1,
    tipAr: "الحلقات المتداخلة (Target Rings) على الأوراق المسنة السفلية هي البصمة الشهيرة لللفحة المبكرة (Alternaria solani).",
    tipEn: "Target-like concentric rings on lower older foliage identify Early Blight (Alternaria solani)."
  },
  {
    id: "q3",
    image: "./assets/diseases/magnesium-deficiency.jpg",
    questionAr: "اصفرار بين عروق الأوراق المسنة السفلية في محصول البطاطس مع بقاء العروق نفسها خضراء يشير غالباً إلى:",
    questionEn: "Interveinal yellowing on older lower potato leaves while the veins stay green most commonly indicates:",
    optionsAr: ["نقص عنصر الماغنسيوم", "اللفحة المتأخرة", "العفن الرمادي", "البياض الدقيقي"],
    optionsEn: ["Magnesium Deficiency", "Late Blight", "Gray Mold", "Powdery Mildew"],
    correctIndex: 0,
    tipAr: "الماغنسيوم عنصر متحرك داخل النبات، لذا عند نقصه ينسحب من الأوراق السفلية المسنة فيظهر اصفرار بين العروق مع بقاء العرق أخضر.",
    tipEn: "Magnesium is mobile in plants, so deficiency shows up first as interveinal chlorosis on older lower leaves."
  },
  {
    id: "q4",
    image: "./assets/diseases/wheat-leaf-rust.jpg",
    questionAr: "ظهور بثرات دائرية برتقالية إلى بنية محمرة موزعة عشوائياً على أوراق القمح يدل على الإصابة بـ:",
    questionEn: "Small round orange-red pustules scattered randomly on wheat leaves indicate:",
    optionsAr: ["البياض الدقيقي", "صدأ الأوراق في القمح", "ذبول الفيوزاريوم", "الأنثراكنوز"],
    optionsEn: ["Powdery Mildew", "Wheat Leaf Rust", "Fusarium Wilt", "Anthracnose"],
    correctIndex: 1,
    tipAr: "البثرات البرتقالية المبعثرة (وليس في خطوط طولية) تميز صدأ الأوراق (الصدأ البرتقالي) في القمح.",
    tipEn: "Scattered orange pustules (not arranged in long stripes) indicate Wheat Leaf Rust."
  },
  {
    id: "q5",
    image: "./assets/diseases/powdery-mildew.jpg",
    questionAr: "أي مرض تظهر فيه طبقة بيضاء تشبه الدقيق على السطح العلوي للأوراق ويزداد في الأجواء الدافئة قليلة البلل؟",
    questionEn: "Which disease produces a white talcum-like powder on upper leaf surfaces and thrives in warm relatively dry foliage?",
    optionsAr: ["البياض الدقيقي", "البياض الزغبي", "العفن البني", "تجعد الأوراق الفيروسي"],
    optionsEn: ["Powdery Mildew", "Downy Mildew", "Brown Rot", "Yellow Leaf Curl Virus"],
    correctIndex: 0,
    tipAr: "الطبقة البودرية البيضاء فوق السطح العلوي تميز البياض الدقيقي، بخلاف البياض الزغبي الذي ينمو أسفل الورقة في البلل.",
    tipEn: "Powdery white colonies on upper surfaces characterize Powdery Mildew."
  }
];
