const hoursFromNow = (hours) => new Date(Date.now() + hours * 60 * 60 * 1000).toISOString();
const hoursAgo = (hours) => new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();

export const createSeedData = () => ({
  departments: [
    {
      id: 'dept-police',
      name: 'Police',
      prefix: 'P-',
      jurisdictionPincodes: ['110001', '110002', '110003', '110004', '560001']
    },
    {
      id: 'dept-fire',
      name: 'Fire',
      prefix: 'FB-',
      jurisdictionPincodes: ['110001', '110003', '110005', '560001']
    },
    {
      id: 'dept-traffic',
      name: 'Traffic',
      prefix: 'T-',
      jurisdictionPincodes: ['110001', '110002', '110006', '560001']
    },
    {
      id: 'dept-municipality',
      name: 'Municipality',
      prefix: 'M-',
      jurisdictionPincodes: ['110001', '110004', '110005', '560001']
    }
  ],
  pincodeDepartmentMapping: {
    '110001': ['Police', 'Fire', 'Traffic', 'Municipality'],
    '110002': ['Police', 'Traffic'],
    '110003': ['Police', 'Fire'],
    '110004': ['Police', 'Municipality'],
    '110005': ['Fire', 'Municipality'],
    '110006': ['Traffic'],
    '560001': ['Police', 'Fire', 'Traffic', 'Municipality']
  },
  applications: [
    {
      id: 'UEPP-2026-001',
      eventName: 'City Cultural Parade',
      organizerName: 'Urban Arts Council',
      eventType: 'Parade',
      date: '2026-04-18',
      venue: 'Rajpath Avenue',
      area: 'Central District',
      pincode: '110001',
      crowdSize: 3500,
      riskLevel: 'High',
      requiredDepartments: ['Police', 'Fire', 'Traffic', 'Municipality'],
      statusByDepartment: {
        Police: 'Pending',
        Fire: 'In Review',
        Traffic: 'Pending',
        Municipality: 'Approved'
      },
      reviewedAtByDepartment: {
        Municipality: hoursAgo(6)
      },
      overallStatus: 'In Review',
      submittedAt: hoursAgo(20),
      dueAt: hoursFromNow(18),
      aiRiskBreakdown: {
        capacityUtilization: 88,
        exitSafetyRating: 'Moderate',
        riskScore: 82,
        recommendation: 'AI Recommendation: Additional safety measures required.'
      },
      documents: ['Venue Owner Consent', 'Event Layout Plan', 'Safety Plan', 'Insurance'],
      focusData: {
        Police: {
          crowdSize: 'Estimated 3,500 attendees',
          securityPlanning: '80 private marshals + 40 police personnel planned',
          publicSafety: 'Metal detectors and barricade lanes are partially planned'
        },
        Fire: {
          fireworks: 'Low-intensity pyrotechnics at opening ceremony',
          temporaryStructures: 'Three temporary stage ramps and control booths',
          exitSafety: 'Two emergency corridors active, one still blocked'
        },
        Traffic: {
          roadClosure: 'Partial closure requested for 4.2 km route',
          parking: 'Overflow parking requested at Sector C ground',
          trafficFlow: 'Diversion map submitted for peak hour traffic'
        },
        Municipality: {
          wasteManagement: '40 bins and 2 cleanup vans planned',
          publicSpaceUsage: 'Public boulevard occupation from 9AM to 9PM',
          foodStalls: '26 temporary food stalls included'
        }
      },
      rejectionReasonByDepartment: {},
      queryByDepartment: {},
      decisionHistory: []
    },
    {
      id: 'UEPP-2026-002',
      eventName: 'Night Food Carnival',
      organizerName: 'Taste Makers Guild',
      eventType: 'Festival',
      date: '2026-04-11',
      venue: 'Riverfront Grounds',
      area: 'East Circle',
      pincode: '110005',
      crowdSize: 1800,
      riskLevel: 'Medium',
      requiredDepartments: ['Fire', 'Municipality'],
      statusByDepartment: {
        Fire: 'Pending',
        Municipality: 'Pending'
      },
      reviewedAtByDepartment: {},
      overallStatus: 'Pending',
      submittedAt: hoursAgo(8),
      dueAt: hoursFromNow(54),
      aiRiskBreakdown: {
        capacityUtilization: 64,
        exitSafetyRating: 'Good',
        riskScore: 58,
        recommendation: 'AI Recommendation: Proceed with routine compliance checks.'
      },
      documents: ['Venue Owner Consent', 'Event Layout Plan', 'Safety Plan', 'Insurance'],
      focusData: {
        Fire: {
          fireworks: 'No fireworks proposed',
          temporaryStructures: '15 temporary stalls and 1 elevated kitchen platform',
          exitSafety: 'All marked exits visible, one route needs wider barricade gap'
        },
        Municipality: {
          wasteManagement: 'Night sweep plan attached with 3 sanitation teams',
          publicSpaceUsage: 'Public promenade usage from 5PM to 1AM',
          foodStalls: '52 food stalls registered'
        }
      },
      rejectionReasonByDepartment: {},
      queryByDepartment: {},
      decisionHistory: []
    },
    {
      id: 'UEPP-2026-003',
      eventName: 'Tech Expo Summit',
      organizerName: 'Future Stack India',
      eventType: 'Exhibition',
      date: '2026-04-23',
      venue: 'Metro Convention Hall',
      area: 'North Tech Park',
      pincode: '110002',
      crowdSize: 1200,
      riskLevel: 'Low',
      requiredDepartments: ['Police', 'Traffic'],
      statusByDepartment: {
        Police: 'Approved',
        Traffic: 'Approved'
      },
      reviewedAtByDepartment: {
        Police: hoursAgo(12),
        Traffic: hoursAgo(16)
      },
      overallStatus: 'Approved',
      submittedAt: hoursAgo(30),
      dueAt: hoursFromNow(70),
      aiRiskBreakdown: {
        capacityUtilization: 52,
        exitSafetyRating: 'Excellent',
        riskScore: 24,
        recommendation: 'AI Recommendation: No additional control action required.'
      },
      documents: ['Venue Owner Consent', 'Event Layout Plan', 'Safety Plan', 'Insurance'],
      focusData: {
        Police: {
          crowdSize: 'Expected 1,200 mixed attendees',
          securityPlanning: 'RFID passes and access checkpoints approved',
          publicSafety: 'Medical desk and emergency lane validated'
        },
        Traffic: {
          roadClosure: 'No closure requested',
          parking: 'Underground parking capacity at 82%',
          trafficFlow: 'Ingress/egress schedule approved'
        }
      },
      rejectionReasonByDepartment: {},
      queryByDepartment: {},
      decisionHistory: []
    },
    {
      id: 'UEPP-2026-004',
      eventName: 'Highway Bike Rally',
      organizerName: 'Rider Front',
      eventType: 'Rally',
      date: '2026-04-08',
      venue: 'Outer Ring Highway',
      area: 'West Mobility Zone',
      pincode: '110006',
      crowdSize: 950,
      riskLevel: 'High',
      requiredDepartments: ['Traffic', 'Police'],
      statusByDepartment: {
        Traffic: 'Rejected',
        Police: 'Pending'
      },
      reviewedAtByDepartment: {
        Traffic: hoursAgo(3)
      },
      overallStatus: 'Rejected',
      submittedAt: hoursAgo(40),
      dueAt: hoursFromNow(-2),
      aiRiskBreakdown: {
        capacityUtilization: 91,
        exitSafetyRating: 'Weak',
        riskScore: 86,
        recommendation: 'AI Recommendation: Route redesign and marshal increase required.'
      },
      documents: ['Venue Owner Consent', 'Event Layout Plan', 'Safety Plan', 'Insurance'],
      focusData: {
        Traffic: {
          roadClosure: 'Full closure requested for 22 km',
          parking: 'No dedicated parking provided',
          trafficFlow: 'Diversion routing incomplete for emergency lanes'
        },
        Police: {
          crowdSize: 'Expected 950 riders + public spectators',
          securityPlanning: 'Marshalling headcount insufficient for route length',
          publicSafety: 'No heat zone evacuation point in plan'
        }
      },
      rejectionReasonByDepartment: {
        Traffic: 'Emergency corridor and diversion plan are non-compliant.'
      },
      queryByDepartment: {},
      decisionHistory: []
    },
    {
      id: 'UEPP-2026-005',
      eventName: 'Community Sports League',
      organizerName: 'Youth Sports Mission',
      eventType: 'Sports',
      date: '2026-04-16',
      venue: 'Public Stadium Ground',
      area: 'Central District',
      pincode: '110001',
      crowdSize: 2200,
      riskLevel: 'Medium',
      requiredDepartments: ['Police', 'Fire', 'Municipality'],
      statusByDepartment: {
        Police: 'Query Raised',
        Fire: 'Pending',
        Municipality: 'Approved'
      },
      reviewedAtByDepartment: {
        Police: hoursAgo(5),
        Municipality: hoursAgo(10)
      },
      overallStatus: 'Query',
      submittedAt: hoursAgo(18),
      dueAt: hoursFromNow(32),
      aiRiskBreakdown: {
        capacityUtilization: 73,
        exitSafetyRating: 'Moderate',
        riskScore: 61,
        recommendation: 'AI Recommendation: Submit revised crowd segregation plan.'
      },
      documents: ['Venue Owner Consent', 'Event Layout Plan', 'Safety Plan', 'Insurance'],
      focusData: {
        Police: {
          crowdSize: '2,200 audience with 14 participating teams',
          securityPlanning: 'Need clearer entry lane separation for players and crowd',
          publicSafety: 'Medical post location is outside recommended perimeter'
        },
        Fire: {
          fireworks: 'No fireworks proposed',
          temporaryStructures: 'Temporary audience bleachers for 600 seats',
          exitSafety: 'Two exits require wider aisle clearances'
        },
        Municipality: {
          wasteManagement: 'On-site segregation bins mapped across 5 clusters',
          publicSpaceUsage: 'Stadium and adjacent lawn requested for warmup area',
          foodStalls: '12 licensed food counters submitted'
        }
      },
      rejectionReasonByDepartment: {},
      queryByDepartment: {
        Police: {
          message: 'Please submit a revised gate control and evacuation sketch.',
          raisedAt: hoursAgo(5)
        }
      },
      decisionHistory: []
    },
    {
      id: 'UEPP-2026-006',
      eventName: 'Monsoon Relief Camp',
      organizerName: 'City Volunteers Network',
      eventType: 'Camp',
      date: '2026-04-10',
      venue: 'Ward 12 Community Hall',
      area: 'South Sector',
      pincode: '110004',
      crowdSize: 700,
      riskLevel: 'Low',
      requiredDepartments: ['Police', 'Municipality'],
      statusByDepartment: {
        Police: 'Pending',
        Municipality: 'Pending'
      },
      reviewedAtByDepartment: {},
      overallStatus: 'Pending',
      submittedAt: hoursAgo(4),
      dueAt: hoursFromNow(46),
      aiRiskBreakdown: {
        capacityUtilization: 49,
        exitSafetyRating: 'Good',
        riskScore: 29,
        recommendation: 'AI Recommendation: Proceed with local logistics verification.'
      },
      documents: ['Venue Owner Consent', 'Event Layout Plan', 'Safety Plan', 'Insurance'],
      focusData: {
        Police: {
          crowdSize: 'Approx. 700 beneficiaries expected',
          securityPlanning: 'Volunteer crowd marshals listed',
          publicSafety: 'No sensitive risk zones reported'
        },
        Municipality: {
          wasteManagement: 'Daily cleanup and disposal pickup planned',
          publicSpaceUsage: 'Indoor hall and temporary canopy outside entrance',
          foodStalls: 'Distribution counters only, no sales stalls'
        }
      },
      rejectionReasonByDepartment: {},
      queryByDepartment: {},
      decisionHistory: []
    },
    {
      id: 'UEPP-2026-007',
      eventName: 'Lakefront Music Evening',
      organizerName: 'Soundwave Collective',
      eventType: 'Concert',
      date: '2026-04-14',
      venue: 'Lakeside Open Arena',
      area: 'North Lake Zone',
      pincode: '110003',
      crowdSize: 2600,
      riskLevel: 'High',
      requiredDepartments: ['Police', 'Fire'],
      statusByDepartment: {
        Police: 'Pending',
        Fire: 'Pending'
      },
      reviewedAtByDepartment: {},
      overallStatus: 'Pending',
      submittedAt: hoursAgo(9),
      dueAt: hoursFromNow(22),
      aiRiskBreakdown: {
        capacityUtilization: 84,
        exitSafetyRating: 'Moderate',
        riskScore: 76,
        recommendation: 'AI Recommendation: Strengthen emergency access and crowd channeling.'
      },
      documents: ['Venue Owner Consent', 'Event Layout Plan', 'Safety Plan', 'Insurance'],
      focusData: {
        Police: {
          crowdSize: 'Projected peak crowd 2,600',
          securityPlanning: 'Current staffing ratio below policy threshold',
          publicSafety: 'Crowd inflow chokepoint near Gate B identified'
        },
        Fire: {
          fireworks: 'Stage pyros in final segment',
          temporaryStructures: 'Sound tower and overhead truss structures',
          exitSafety: 'Fire lane width compliant, secondary exit signage weak'
        }
      },
      rejectionReasonByDepartment: {},
      queryByDepartment: {},
      decisionHistory: []
    },
    {
      id: 'UEPP-2026-008',
      eventName: 'Smart Mobility Demo',
      organizerName: 'Mobility Labs',
      eventType: 'Demo',
      date: '2026-04-20',
      venue: 'Innovation Plaza',
      area: 'Tech Corridor',
      pincode: '560001',
      crowdSize: 1500,
      riskLevel: 'Medium',
      requiredDepartments: ['Police', 'Fire', 'Traffic', 'Municipality'],
      statusByDepartment: {
        Police: 'Approved',
        Fire: 'Pending',
        Traffic: 'In Review',
        Municipality: 'Pending'
      },
      reviewedAtByDepartment: {
        Police: hoursAgo(1),
        Traffic: hoursAgo(2)
      },
      overallStatus: 'In Review',
      submittedAt: hoursAgo(14),
      dueAt: hoursFromNow(38),
      aiRiskBreakdown: {
        capacityUtilization: 69,
        exitSafetyRating: 'Good',
        riskScore: 57,
        recommendation: 'AI Recommendation: Validate temporary structure load handling.'
      },
      documents: ['Venue Owner Consent', 'Event Layout Plan', 'Safety Plan', 'Insurance'],
      focusData: {
        Police: {
          crowdSize: 'Expected 1,500 participants',
          securityPlanning: 'RF screening plan submitted',
          publicSafety: 'Night operations require extra perimeter lighting'
        },
        Fire: {
          fireworks: 'No fireworks included',
          temporaryStructures: 'Drone test net and demo pavilions',
          exitSafety: 'Two exits clear, one blocked by equipment cage'
        },
        Traffic: {
          roadClosure: 'Two lane closure requested near Innovation Plaza',
          parking: 'Shuttle + remote parking plan uploaded',
          trafficFlow: 'Peak-hour lane diversion map under review'
        },
        Municipality: {
          wasteManagement: 'Recycling bins and pickup routes mapped',
          publicSpaceUsage: 'Plaza occupancy requested for 2 days',
          foodStalls: '8 branded kiosks requested'
        }
      },
      rejectionReasonByDepartment: {},
      queryByDepartment: {},
      decisionHistory: []
    }
  ]
});
