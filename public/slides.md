<!-- .slide: class="title" -->

# Evolve or Die

High-Availability Design Principles Drawn from Google's Network Infrastructure

Govindan et al. · SIGCOMM 2016

Lead discussion: Vincent Nguyen, Cheng Peng

---

## TL;DR

- **Data:** 103 post-mortems of Google network failures over two years
- **Finding:** failures hit every network and every plane, with no dominant root cause
- **Cause:** ~70 happened **while the network was being changed** (a management operation)
- **Lesson:** no silver bullet

<blockquote><span class="fragment strike" data-fragment-index="0">If it works, don't touch it.</span> <span class="fragment" data-fragment-index="0">Touch it often, and make touching it safe.</span></blockquote>

Note:
Click once: the old sysadmin rule gets struck out and replaced by the paper's answer.
The rest of the talk is the evidence for these lines.
MOp = management operation: upgrades, config changes, drains, replacing hardware. Google schedules ~585 a week.
The conclusion is counter-intuitive: the data says change causes failures, yet the answer is more change, made small and automated.

---

## Outline

1. Google's network
2. Why high availability is hard
3. What breaks: 103 post-mortems
4. Failures and their lessons

---

<!-- .slide: class="section" -->

## Google's network

---

<!-- .slide: class="case" -->

## Three networks

<div class="net-slot" data-net="topology" data-scale="0.62"></div>

<ol class="steps">
<li class="fragment fade-out" data-fragment-index="0">Clusters, plus two WANs that connect them. Hover any box for details</li>
<li class="fragment current-visible" data-fragment-index="0" data-n="1" data-hl="fabric cluster-1 cluster-2">Each <b>cluster</b> is a multi-stage Clos fabric of merchant-silicon switches: ToR, superblock, spine</li>
<li class="fragment current-visible" data-fragment-index="1" data-n="2" data-hl="car up">Its <b>CAR</b> (cluster aggregation router) connects it to both WANs: one B4BR and two B2BRs</li>
<li class="fragment current-visible" data-fragment-index="2" data-n="3" data-hl="b4br b4-bundle">On <b>B4</b>, B4BRs connect over point-to-point bundles of many parallel links, but <b>not every pair</b> has one</li>
<li class="fragment current-visible" data-fragment-index="3" data-n="4" data-hl="b2br b2cr b2-bundle internet peer"><b>B2</b> adds a core layer: B2CRs link the B2BRs to each other and to the edge routers that peer with ISPs</li>
<li class="fragment current-visible" data-fragment-index="4" data-n="5" data-hl="path-user internet b2cr-3 b2cr-2 b2br-1 car-1 fabric-1">A <b>user request</b>: Internet → B2CR → B2CR → B2BR → CAR → a front-end in the cluster</li>
<li class="fragment current-visible" data-fragment-index="5" data-n="6" data-hl="path-copy car-1 car-2 b4br-a b4br-b b4br-d fabric-1 fabric-2">An <b>internal copy</b>: these two B4BRs share no bundle, so it crosses a third one in between</li>
<li class="fragment current-visible" data-fragment-index="6" data-n="7" data-hl="path-fallback car-1 car-2 b2br-2 fabric-1 fabric-2" data-fail="b4br b4-bundle">If <b>B4 fails</b>, CARs send that traffic over B2 instead, which B2 must now absorb</li>
</ol>

Note:
WAN links are bundles: many physical links aggregated between two routers.
Several generations of cluster fabric coexist. In older ones the CAR is a separate Clos fabric; in the newest, some fabric blocks act as the CAR.
B4 has no core routers: each bundle joins two B4BRs with only fiber and optical gear in between. But B4 is not a full mesh, so B4BRs in the middle of a path carry transit traffic, doing the core's job.
B2 has a dedicated core layer; user traffic can cross several B2CRs.
The fallback in step 7 is exactly what overloads B2 in CPN-1 and Casc-1 later.

---

## Why two WANs?

<div class="cols2">
<div><h3>B2 has to be ordinary</h3><ul><li>Peers with many networks and vendors, so it needs <strong>many protocols</strong></li><li>Reaches users everywhere, so its topology is <strong>dense</strong></li><li>Carries user traffic, so it needs the <strong>highest availability</strong></li></ul></div>
<div><h3>B4 can break the rules</h3><ul><li><strong>Elastic</strong> bulk copies can live with a temporary bandwidth cut</li><li>Only a <strong>few dozen</strong> sites, so central control works</li><li>Google owns <strong>both ends</strong>, so it rate-limits at the edge instead of overprovisioning</li><li>Typical WANs run at 30–40%, which costs <strong>2–3×</strong>; B4 runs busy links near 100%</li></ul></div>
</div>

<p class="caption">Jain et al., "B4: Experience with a Globally-Deployed Software Defined WAN", SIGCOMM 2013 (reference [18])</p>

Note:
B4 was originally designed as a low-cost backend backbone for bulk copy traffic, and later became critical infrastructure.
By 2013 B4 carried more than 90% of internal application traffic, and more traffic than the public-facing WAN.
B4's traffic classes, in increasing volume and decreasing priority: user data copies, remote storage access, large-scale data pushes.
This explains later findings: B4 failures last longer (no high-priority traffic) and are mostly control-plane (a large, new software stack).

---

## B4 vs B2

| | B4 | B2 |
|---|---|---|
| Carries | Data center ↔ data center | Users ↔ data centers, Internet peering |
| Sites | A few dozen data centers | Dense: border, core and edge routers |
| Hardware | Merchant-silicon switches | Vendor routers |
| Routing and TE | Central TE server, tunnels | IS-IS, eBGP, MPLS tunnels via RSVP |
| Priorities | Priority queues; BwE admits and rate-limits at the edge | Traffic marking, vendor QoS, low-priority tunnels |

Note:
B2 keeps high-priority traffic on the shortest path by mapping low-priority traffic into low-priority tunnels. MPLS auto-bandwidth resizes tunnels as demand changes.
B2 uses route reflection to scale BGP.

---

## Services, priorities and draining

- **Internal** customers: distributed storage and batch computation, e.g. rebuilding search indices
- **User-facing** services: front-ends near users (proxy + cache) send requests to back-ends
- Load balancers choose both, so operators can **drain** a cluster: steer traffic away before or during trouble
- Priorities: **user-facing high, internal low**, enforced by both WANs

> Draining is the main escape hatch. It shows up in almost every case study.

Note:
DNS load balancing sends users to a front-end; a load balancer tracking backend load picks the back-end.
Drains cost capacity, and resuming service afterwards can take a long time, e.g. while storage replication catches up.
A MOp judged high risk drains the affected services first. Risk-1 is a MOp that should have been drained and wasn't.

---

<!-- .slide: class="case" -->

## Control plane: fabrics and B4BRs

<div class="net-slot" data-net="fabric-cp" data-scale="0.7"></div>

<ol class="steps">
<li class="fragment fade-out" data-fragment-index="0">The same three components run every cluster fabric and every B4BR. Hover any box for details</li>
<li class="fragment current-visible" data-fragment-index="0" data-n="1" data-hl="fc fc-ofc">The <b>FC</b> computes paths through the Clos fabric</li>
<li class="fragment current-visible" data-fragment-index="1" data-n="2" data-hl="ra ra-peers ra-ofc peers">The <b>RA</b> exchanges BGP and IS-IS routes with routers outside the fabric</li>
<li class="fragment current-visible" data-fragment-index="2" data-n="3" data-hl="ofc sw">The <b>OFC</b> turns both into forwarding rules and programs every switch through its OFA</li>
<li class="fragment current-visible" data-fragment-index="3" data-n="4" data-hl="cpn-r1 cpn-r2 cpn-link">They all talk over the <b>CPN</b>, a separate network that survives one router failure</li>
</ol>

Note:
Every component is replicated with master/standby failover (a B4BR runs three copies).
The split into three components is for software modularity. It also means their state can drift apart, which is Consis-1.
The CPN routers run VRRP, which presents the pair as one virtual router.

---

<!-- .slide: class="case" -->

## Control plane: the B4 WAN

<div class="net-slot" data-net="b4-cp" data-scale="0.7"></div>

<ol class="steps">
<li class="fragment fade-out" data-fragment-index="0">Above the B4BRs sits a global control plane. Hover any box for details</li>
<li class="fragment current-visible" data-fragment-index="0" data-n="1" data-hl="gw gw-b4br gw-topo topo">The <b>Gateway</b> reads state from every B4BR; the <b>Topology Modeler</b> turns it into a model of links and capacity</li>
<li class="fragment current-visible" data-fragment-index="1" data-n="2" data-hl="bwe bwe-te">The <b>BwE</b> estimates each application's demand and holds it to its approved rate</li>
<li class="fragment current-visible" data-fragment-index="2" data-n="3" data-hl="te topo-te bwe-te">The <b>TE Server</b> computes site-level paths from the model and the demand</li>
<li class="fragment current-visible" data-fragment-index="3" data-n="4" data-hl="te-gw gw gw-b4br b4br b4-bundle">The Gateway programs those paths into the B4BRs, which <b>tunnel</b> traffic across bundles</li>
<li class="fragment current-visible" data-fragment-index="4" data-n="5" data-hl="shift b2br">Two fallbacks: switch TE off and use <b>shortest-path routing</b>, or move the traffic to <b>B2</b></li>
</ol>

Note:
Every global component is replicated, with replicas in geographically diverse sites.
TE is layered on top of ordinary routing using higher-priority forwarding entries. That is what makes the TE off-switch possible: it was B4's original "big red button".
Each B4BR translates one site-level path into paths through its own fabric and across one or more bundles.

---

## Three planes

| Plane | What it does | Examples |
|---|---|---|
| Data | Forwards packets | Line cards, links, switch OS |
| Control | Computes and propagates forwarding state | FC/RA/OFC, TE Server, BGP |
| Management | Changes the network: MOps | Upgrades, config pushes, drains |

> Every failure in the paper is attributed to one of these planes.

Note:
Attribution is a judgement call. A link failure that triggers a control-plane bug counts as control plane, since the control plane should have tolerated it.

---

<!-- .slide: class="section" -->

## Why high availability is hard

---

## Why it's hard

- **Target:** only a few minutes of downtime per month for some traffic classes
- **Scale and heterogeneity:** two vendors on purpose, 2–3 generations of cluster design at once
- **Velocity:** some part of the network is being upgraded every day
- **Device management:** 20 Tb/s boxes, still managed device by device, often through a CLI
- **Tight targets vs. slow upgrades:** a border router upgrade can take 8+ hours, so either drain (costs capacity) or upgrade in place (fragile)

Note:
Availability is measured per minute. B4 uses its TE instrumentation; B2 and clusters use cluster-to-cluster pings, a system similar to Pingmesh.
A cluster is unavailable for a traffic class if loss from all other clusters exceeds a threshold of 0.1–2%.

---

## They were already doing it right

- Capacity planning, redundant routers, disjoint fiber and power
- Every controller replicated with failover; WAN replicas spread geographically
- Services register traffic priorities; BwE marks and rate-limits them
- Regression tests, canaries, disaster drills
- Every MOp documented with steps, duration and a risk assessment

> …and still: 103 high-impact failures in two years.

---

<!-- .slide: class="section" -->

## What breaks

---

## Dataset: 103 post-mortems

<div class="chart" data-chart="dataset"></div>

<p class="caption">Blameless, peer-reviewed, root causes often reproduced in a lab. Only <strong>unique</strong> failures: a repeat isn't written up again.</p>

Note:
Every network post-mortem at Google over two years. Each has a timeline, impact, root causes and action items.
Because only unique failures are written up, every count in the paper is a count of distinct failures, not a failure rate. The authors avoid trends over time for the same reason.
Chart values are read off the paper's Figures 2–7. Figures 2–4 each sum to exactly 103.

---

## No single place to fix

<div class="chart-row">
<div class="chart" data-chart="planes"></div>
<div class="chart" data-chart="elements"></div>
</div>

<p class="caption">Every network fails in every plane. Only B4 leans one way: 16 of its 26 failures are control-plane.</p>

Note:
Five elements cause 10+ failures each. B2BRs, CARs and fabrics sit at critical points in the topology.
ToRs fail through buggy software pushed to many ToRs at once. The CPN (shared by clusters and B4) takes down whole control planes. Among WAN controllers, BwE stands out.
Plane totals: control 43, data 26, management 34.

---

## Failures are big

<div class="chart" data-chart="impact"></div>

<p class="caption">34 events blackholed traffic, often for whole clusters. B4 carries no high-priority traffic, so it is absent from those rows.</p>

Note:
High/low loss is split using the same loss thresholds as the availability targets (0.1–2% depending on the class).
"No impact" events are latent failures found before they hurt anything; operators chose to wait to fix them.

---

## …and slow

<div class="chart" data-chart="duration"></div>

<p class="caption">Time from discovery to repair. Shaded: 10–100 minutes. The budget for high-priority traffic is a few <em>minutes per month</em>.</p>

Note:
Discrepancy worth raising: the text says about 80% of failures lasted 10–100 minutes, but reading Figure 5 gives roughly half (B2 about two-thirds, clusters and B4 under half).
Under 10 minutes: the cause was obvious or operators had seen it before. Over 100 minutes: usually low-priority loss, or a latent bug waiting on a release or a replacement part.
B4 has the longest tail because it carries no high-priority traffic.
Duration stops at the repair, not when services are back; that can take much longer (e.g. replication catching up after a drain).

---

## Evolution is in the loop

<div class="chart" data-chart="evolution"></div>

<p class="caption">Categories overlap: upgrades, config changes and rollouts are all kinds of MOp. With 585 MOps a week, this is not a failure rate.</p>

Note:
A MOp in progress on the failing element does not mean the MOp was the root cause.
The MOp count does not include automated MOps that are not documented for review.

---

## Root causes: 19 categories

<div class="chart" data-chart="causes"></div>

<p class="caption">One failure can have several root causes. 6+ categories appear in all three networks: systemic, not one bad design.</p>

Note:
The authors avoid the coarse "hardware / software / config" split because it only yields generic advice.
Some categories belong to one network by design: the cascade of control-plane elements is B4-only.
Split by plane: 6 data, 7 control, 6 management.

---

<!-- .slide: class="section" -->

## Failures and their lessons

---

<!-- .slide: class="case" -->

## CPN-1: split brain in a B4BR

<div class="net-slot" data-net="fabric-cp" data-scale="0.7"></div>

<ol class="steps">
<li class="fragment fade-out" data-fragment-index="0">A B4BR runs replicated OFCs that reach their switches over the CPN</li>
<li class="fragment current-visible" data-fragment-index="0" data-n="1" data-fail="cpn-r1" data-hl="cpn-r2">A CPN router is taken down for power re-cabling. VRRP should fail over to the other one transparently</li>
<li class="fragment current-visible" data-fragment-index="1" data-n="2" data-fail="ofc">But VRRP fails over <b>slower than the OFC liveness timeout</b>: the OFCs lose each other and both declare themselves master</li>
<li class="fragment current-visible" data-fragment-index="2" data-n="3" data-hl="ofc-1" data-fail="sw">A watchdog resolves it, but the new master can't rebuild port state, so it <b>pushes wrong forwarding state</b> to every switch</li>
<li class="fragment current-visible" data-fragment-index="3" data-n="4">The B4BR blackholes. Its clusters fail over to B2, which <b>overloads</b></li>
<li class="fragment current-visible lesson" data-fragment-index="4" data-n="✓" data-reset data-fail="sw-1 sw-2 sw-3" data-ok="sw-4 sw-5 sw-6 vr"><b>Contain the failure radius:</b> split the B4BR into <i>k</i> virtual routers, each with its own control plane, so a failure costs only 1/<i>k</i></li>
</ol>

Note:
Data-plane category: control plane network failure.
Two timers that were each reasonable on their own interacted badly. The fallback to B2 then turned one failure into a second one.
The lesson view shows k = 2: one virtual router fails, the other keeps forwarding.

---

<!-- .slide: class="case" -->

## BugAuto-1: automation vs. a new abstraction

<div class="net-slot" data-net="topology" data-scale="0.62"></div>

<ol class="steps">
<li class="fragment fade-out" data-fragment-index="0">Each cluster reaches both WANs through its CAR</li>
<li class="fragment current-visible" data-fragment-index="0" data-n="1" data-hl="car-1">A script upgrades control-plane software across the CAR's 4 blocks, <b>draining and undraining links in order</b></li>
<li class="fragment current-visible" data-fragment-index="1" data-n="2" data-hl="car-1 up-1">But <b>supertrunking</b> (one logical link across several switches) was recently enabled here, and it needs a different order</li>
<li class="fragment current-visible" data-fragment-index="2" data-n="3" data-fail="car-1 up-1 cluster-1">BGP adjacencies never came back: the cluster was <b>cut off from both WANs</b></li>
<li class="fragment current-visible lesson" data-fragment-index="3" data-n="✓" data-reset data-ok="car-1 up-1"><b>Big red button:</b> keep the old trunk abstraction alive, with a switch to fall back to it when the new one breaks</li>
</ol>

Note:
Management-plane category: bug in management-plane automation.
The control plane evolved (supertrunking) but the management plane's scripts didn't.
Automation raised the level of abstraction and improved availability overall, but it also adds a layer that can fail at scale.

---

<!-- .slide: class="principle" -->

## Defense in depth

- **Contain the failure radius:** split a B4BR or CAR into *k* virtual routers, each with its own control plane
  - One failure costs 1/*k* of capacity, and a virtual router is the unit for MOps
- **Fallbacks:** B4 → B2 and back; TE → plain IP routing
- **Big red buttons:** every new feature keeps the old one alive, plus a switch to go back

Note:
Concurrent failure of *all* replicas of a controller is not uncommon (BugAuto-1), so replication alone isn't enough.
Partitioning alternative: "color" links and switches and give each color its own control plane.

---

<!-- .slide: class="case" -->

## Consis-1: RA and OFC disagree

<div class="net-slot" data-net="fabric-cp" data-scale="0.7"></div>

<ol class="steps">
<li class="fragment fade-out" data-fragment-index="0">RA turns BGP/IS-IS into routes plus <b>nexthop groups</b> (ECMP sets); the OFC stores them and programs switches</li>
<li class="fragment current-visible" data-fragment-index="0" data-n="1" data-hl="ra sw-3">A nexthop group's last route is withdrawn. RA's delete on the switch fails transiently, so RA <b>keeps a cached copy</b></li>
<li class="fragment current-visible" data-fragment-index="1" data-n="2" data-hl="ra ra-ofc ofc">A full table update (e.g. a BGP reset) skips unused groups, so the OFC correctly <b>deletes it</b></li>
<li class="fragment current-visible" data-fragment-index="2" data-n="3" data-hl="ra" data-fail="ra-ofc ofc sw">A new route reuses the cached group. The OFC has no record of it and <b>drops the route</b>: no flow entries, blackhole</li>
<li class="fragment current-visible" data-fragment-index="3" data-n="4">ECMP and RPC retries made it look like intermittent loss. It took <b>weeks</b> to root-cause</li>
<li class="fragment current-visible lesson" data-fragment-index="4" data-n="✓" data-reset data-ok="ra ofc ra-ofc"><b>Track state equivalence:</b> continuously compare RA and OFC route counts, so the mismatch is flagged before routes go missing</li>
</ol>

Note:
Control-plane category: lack of consistency between control-plane elements.
A routing config change had made full table updates much more frequent, which made this rare sequence more likely.

---

<!-- .slide: class="principle" -->

## Maintain consistency

- **Within the control plane:** track equivalence; RA vs. OFC route counts would have flagged Consis-1
- **Data vs. control:** don't advertise routes before they're installed
- **Management:** check fabric state after every MOp step; all-or-nothing config changes
- **Invariants:** an unwritten rule (anycast prefixes need path length 3) was broken, and internal DNS went down
- **Positive *and* negative:** a wildcard drained hundreds of devices instead of two, so now large MOps need both a "drain these" list and a "keep these" list

Note:
Many invariants are implicit: CARs connect to 2 B2BRs, OFCs connect to 2 CPN routers, at least one OFC must be running.
Monitoring should rank invariant violations by risk instead of flooding operators with alarms.

---

<!-- .slide: class="case" -->

## Casc-1: a cascade through B4's controllers

<div class="net-slot" data-net="b4-cp" data-scale="0.7"></div>

<ol class="steps">
<li class="fragment fade-out" data-fragment-index="0">Each B4 controller trusts what the one upstream of it says</li>
<li class="fragment current-visible" data-fragment-index="0" data-n="1" data-hl="b4br b4-bundle">During an upgrade, a WAN bundle moves between B4BRs, so link config and routing <b>briefly disagree</b></li>
<li class="fragment current-visible" data-fragment-index="1" data-n="2" data-hl="gw gw-topo" data-fail="topo">That triggers a Topology Modeler bug: some prefixes now appear to <b>originate in two clusters</b></li>
<li class="fragment current-visible" data-fragment-index="2" data-n="3" data-hl="topo-te bwe" data-fail="bwe">BwE assumes a prefix has one origin, so it concludes <b>all of B4 has failed</b></li>
<li class="fragment current-visible" data-fragment-index="3" data-n="4" data-fail="shift b2br">BwE moves B4 traffic for several metros onto B2, which <b>overloads</b></li>
<li class="fragment current-visible lesson" data-fragment-index="4" data-n="✓" data-reset data-ok="topo bwe b4br b4-bundle"><b>Fail open:</b> before believing "all of B4 failed", cross-check with probes or BGP feeds, and keep forwarding on the last good state</li>
</ol>

Note:
Control-plane category: cascade of control-plane elements.
A transient inconsistency during a routine upgrade became a WAN-wide traffic shift.

---

<!-- .slide: class="principle" -->

## Fail open

- When a control plane dies, **keep the last good forwarding state**
- Works if fixing the control plane is faster than the next hardware failure
- Don't trust surprising updates: Casc-1's dual origin could have been checked against probes or BGP feeds
- Another time, the TE Server **invalidated all of B4** over one stale prefix

Note:
This is in tension with being conservative. In both examples the controller's "safe" reaction caused the outage.
Open problems: detecting that a switch has failed open, and having healthy peers keep using it.

---

## Risk-1: the 30% that was really 50%

<p class="lead">MOp: power off 30% of a fabric's switches, restore, repeat (30+ hours)</p>

<div class="bars">
<div class="bar"><span>Estimated loss</span><i style="--v:30%"></i><b>~30%</b></div>
<div class="bar bad fragment"><span>Actual loss</span><i style="--v:55%"></i><b>&gt;50%</b></div>
</div>

- Estimated as safe, so services were **not drained**
- **Risk-2:** splitting a B4BR, the estimate was off by 2×, *and* failures elsewhere sent more traffic through it

<p class="lesson fragment"><b>Assess risk continuously:</b> at every step of the MOp, using the control plane's own model of the fabric</p>

Note:
Management-plane category: risk assessment failure.
Capacity in a multistage fabric depends on its topology and power design, not just on what fraction of hardware is off.
Early rule of thumb: losing more than 50% of capacity is risky, because the network is provisioned for a single failure.
Coarse estimates like this were later replaced by an automated tool.

---

<!-- .slide: class="principle" -->

## An ounce of prevention

- Assess risk **continuously**, at every MOp step, for drains *and* undrains
- Build risk assessment into the control plane, using the same state and algorithms
- Easier on in-house B4 and clusters than on vendor B2, which is a black box; when unsure, overestimate the risk
- **Canaries:** 0.1% of ToRs in a small cluster, then more, then a bigger cluster, monitoring for days at each stage

Note:
Risk assessments went wrong from bad capacity or demand estimates, the network changing between assessment and MOp (Risk-2), intermediate MOp states, and not knowing about concurrent MOps.
Replicated controllers like the B4 Gateway are updated one replica at a time while watching consensus between replicas.

---

<!-- .slide: class="case" -->

## Over-1: the outage nobody could see

<div class="net-slot" data-net="fabric-cp" data-scale="0.7"></div>

<ol class="steps">
<li class="fragment fade-out" data-fragment-index="0">A cluster fabric, with its monitoring collectors</li>
<li class="fragment current-visible" data-fragment-index="0" data-n="1" data-hl="sw-3">A link is drained by lowering its preference, so it <b>still carries traffic</b> while bit-error tests make it drop packets</li>
<li class="fragment current-visible" data-fragment-index="1" data-n="2" data-hl="ofc sw">OFAs lose their OFC and fail over through an OpenFlow frontend, which first does a <b>reverse DNS lookup</b></li>
<li class="fragment current-visible" data-fragment-index="2" data-n="3" data-fail="fc ofc ra">The lookups' packets die on the bad link; blocked threads hit the <b>OS thread limit</b> and the whole control plane fails</li>
<li class="fragment current-visible" data-fragment-index="3" data-n="4" data-fail="mon">Both monitoring collectors were <b>inside this cluster</b>, so operators were blind for a long time</li>
<li class="fragment current-visible lesson" data-fragment-index="4" data-n="✓" data-reset data-ok="mon-ext"><b>Recover fast:</b> collect from two topologically distinct clusters, so a failure can't blind its own monitoring</li>
</ol>

Note:
Data-plane category: device resource overruns.
Drains come in several strengths (lower preference, infinite cost, disable the interface). Lowering preference is the least risky and fastest to undo, but its semantics surprised operators here.

---

<!-- .slide: class="principle" -->

## Recover fast

- Root-causing can take hours, while a whole cluster sits drained
- Operators **chase the wrong anomaly**: a big network always has something odd going on
- Monitoring gaps: probes miss paths, counters miss transients like link flaps
- Put collectors in **two topologically distinct clusters**
- Next: automated root-cause diagnosis

Note:
Operators root-cause failures using an active path-probing system (similar to Pingmesh, our other paper) and passive per-device counters.

---

## Continuously upgrade the network!

- Slowing down means overbuilt capacity, missing features, and change running through rarely-exercised code
- Instead: push features weekly, be able to upgrade daily
- Many small changes are safer and easier to verify than one "big bang"
- Frequent change forces automation, and stops assumptions like "every component runs the same version"

> Touching the network breaks it. So touch it often, and make touching it safe.

---

<!-- .slide: class="section" -->

## Discussion

---

## Discussion

- B4's failures are mostly control-plane. Does centralized SDN trade one kind of failure for another?
- In Casc-1, the "conservative" reaction caused the outage. When should a controller fail open, and when fail safe?
- Only unique failures, in the authors' own categories: what can we conclude about frequency?
- Is "upgrade continuously" a lesson for everyone, or only with Google-scale automation?
- Two vendors on purpose: does heterogeneity buy more availability than its complexity costs?
