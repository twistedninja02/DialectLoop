import { AudioSegment } from './types';

export const SAMPLE_SEGMENTS: AudioSegment[] = [
  {
    segment_id: "seg_dhaka_001",
    district: "Dhaka",
    duration: 31.7,
    transcript: "আমি আগামীকাল সকালের ট্রেনে ঢাকা যাচ্ছি।",
    speaker_id: "spk_101"
  },
  {
    segment_id: "seg_ctg_001",
    district: "Chittagong",
    duration: 28.4,
    transcript: "আঁই আগামীকাল বিয়ানর ট্রেনে হইট্টা যাইউম।", // Chittagong dialect: "I will go to Chittagong tomorrow morning by train"
    speaker_id: "spk_102"
  },
  {
    segment_id: "seg_ctg_mismatch_002",
    district: "Dhaka", // This is actually Chittagong, seeded as a metadata mismatch!
    duration: 32.1,
    transcript: "আঁই যাইউম বাজারে, তুঁই কেন আছ?", 
    speaker_id: "spk_103"
  },
  {
    segment_id: "seg_sylhet_001",
    district: "Sylhet",
    duration: 25.4,
    transcript: "আমি কাইলকা বিহানে ট্রেনে সিলেট যাইয়ার।", // Sylhet dialect
    speaker_id: "spk_104"
  },
  {
    segment_id: "seg_raj_001",
    district: "Rajshahi",
    duration: 30.2,
    transcript: "আমি কাইল সকালে ট্রেনে রাজশাহী য্যাতচি।", // Rajshahi dialect vowel shift
    speaker_id: "spk_105"
  },
  {
    segment_id: "seg_khulna_001",
    district: "Khulna",
    duration: 33.5,
    transcript: "আমি কাইল সকালে রেলে করে খুলনা যাচ্ছি, তুমি কিরাম আছো?", // Khulna dialect
    speaker_id: "spk_106"
  },
  {
    segment_id: "seg_audio_typo_002",
    district: "Chittagong",
    duration: 29.8,
    transcript: "আঁই কাইল সকালে ট্রেনে চিটাগাং যাইহু— না না কাইল যাবো না।", // Has a punctuation and code-switch or disfluency
    speaker_id: "spk_102"
  },
  {
    segment_id: "seg_sylhet_mismatch_002",
    district: "Dhaka", // Seeded Sylhet-Dhaka mismatch (Sylhet dialect, labeled Dhaka). The paper notes this was a common error!
    duration: 34.0,
    transcript: "তুমি কিলা আছো? আমি তো ভালো আছি করের কাম কাজ।",
    speaker_id: "spk_107"
  },
  {
    segment_id: "seg_code_switch_001",
    district: "Khulna",
    duration: 22.1,
    transcript: "আজকে weather অনেক ভালো, আমি market এ যাচ্ছি shopping করতে।", // Code-switch error!
    speaker_id: "spk_108"
  },
  {
    segment_id: "seg_raj_mismatch_002",
    district: "Khulna", // Seeded Rajshahi dialect labeled Khulna (FM-1: Rajshahi is often misclassified as Khulna due to overlapping features)
    duration: 35.6,
    transcript: "উ কাজ কত্তিছে মাঠের মধ্যিখানে, আমি য্যাতচি দেখি আসি।",
    speaker_id: "spk_109"
  },
  {
    segment_id: "seg_dhaka_typo_003",
    district: "Dhaka",
    duration: 29.0,
    transcript: "আমি আগামী কাল স্কুলে জেতে চাই না আমি খেলবো।", // Typo/mishear "জেতে" instead of "যেতে"
    speaker_id: "spk_110"
  },
  {
    segment_id: "seg_ctg_uncertain_001",
    district: "Chittagong",
    duration: 38.3,
    transcript: "আঁই যাইউম নাকি আইজকা ঘরে বইয়া রিউম বুঝতে পারতাছি না ভাই।", // Extremely ambiguous boundary phrases to trigger Critic's human escalation gate
    speaker_id: "spk_103"
  }
];

export const DISTRICT_CLUSTERS = {
  "Dhaka/Central": ["Dhaka", "Gazipur", "Narayanganj"],
  "Chittagong/Southeast": ["Chittagong", "Cox's Bazar", "Feni"],
  "Sylhet/Northeast": ["Sylhet", "Moulvibazar", "Habiganj"],
  "Rajshahi/Northwest": ["Rajshahi", "Bogra", "Pabna"],
  "Khulna/Southwest": ["Khulna", "Jessore", "Satkhira"]
};

export const FEW_SHOTS_EXAMPLES = {
  "Dhaka/Central": [
    {
      standard: "আমি ঢাকা যাচ্ছি",
      dialect: "আমি ঢাকা যাচ্ছি",
      tokens: ["যাচ্ছি"]
    }
  ],
  "Chittagong/Southeast": [
    {
      standard: "আমি যাচ্ছি",
      dialect: "আঁই যাইউম",
      tokens: ["আঁই", "যাইউম"]
    },
    {
      standard: "সে কাজ করছে",
      dialect: "হেঁতে কাম গইত্তেছে",
      tokens: ["হেঁতে", "কাম", "গইত্তেছে"]
    }
  ],
  "Sylhet/Northeast": [
    {
      standard: "তুমি কেমন আছো?",
      dialect: "তুমি কিলা আছো?",
      tokens: ["কিলা"]
    }
  ],
  "Rajshahi/Northwest": [
    {
      standard: "আমি যাচ্ছি",
      dialect: "আমি য্যাতচি",
      tokens: ["য্যাতচি"]
    }
  ],
  "Khulna/Southwest": [
    {
      standard: "তুমি কেমন আছো?",
      dialect: "তুমি কিরাম আছো?",
      tokens: ["কিরাম"]
    }
  ]
};
