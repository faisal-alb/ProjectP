import unittest
from .optimizer import optimize

class OptimizerTest(unittest.TestCase):
    def device(self, **overrides):
        return dict(id='a',kind='battery',maxKw=5,energyKwh=5,capacityKwh=10,reserve=.2,
                    available=True,optedOut=False,minPrice=.1,baselineKw=2,**overrides)
    def test_reserve_budget(self):
        r=optimize([self.device()],[2]*24,.3,960,0,[])
        self.assertLessEqual(sum(r['schedule'][0])*.25,2.85+1e-8)
    def test_ineligible_and_infeasible(self):
        for faults in [['zero-procurement'],['optimizer-infeasible'],['price-ineligible']]:
            r=optimize([self.device()],[2]*24,.3,960,0,faults)
            self.assertEqual(r['dispatch'],[])
            self.assertEqual(r['uncoveredKw'],2)
    def test_no_relief_required(self):
        r=optimize([self.device()],[0]*24,.3,960,0,[])
        self.assertEqual(r['dispatch'],[])
    def test_constraints_and_determinism(self):
        a=optimize([self.device()],[2]*24,.3,960,0,[])
        b=optimize([self.device()],[2]*24,.3,960,0,[])
        self.assertEqual(a,b)
        self.assertTrue(all(0<=p<=5 for p in a['schedule'][0]))

if __name__=='__main__': unittest.main()
